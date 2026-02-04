"""
TOPOLOGY SERVICE - Costruzione grafo di rete

Servizio per costruire un grafo di rete da interfacce multi-firewall.
Algoritmo O(n) basato su hash map bucketing per subnet.

Flusso:
1. Canonicalizzazione: calcola network_id per ogni interfaccia
2. Bucketing: raggruppa interfacce per subnet
3. Link Extraction: crea link per bucket con 2+ nodi diversi
4. Adjacency List: costruisce lista di adiacenza bidirezionale
5. IP Index: costruisce reverse index IP -> (node, interface)
"""

from __future__ import annotations
import asyncio
import logging
from typing import Dict, List, Optional, Set, Tuple, Any
from collections import defaultdict

from application.models.topology import (
    Node,
    InterfaceRecord,
    Link,
    Topology,
)
from domain.ports import FirewallRepository
from domain.models import NetworkInterface


logger = logging.getLogger(__name__)


class TopologyService:
    """
    Servizio per costruire e interrogare la topologia di rete.

    Uso:
        service = TopologyService()

        # Da lista interfacce (sync)
        topology = service.build_topology(interfaces)

        # Da firewall clients (async)
        topology = await service.build_from_firewalls(clients)
    """

    def __init__(self) -> None:
        """Inizializza il servizio."""
        pass

    # =========================================================================
    # PUBLIC METHODS
    # =========================================================================

    def build_topology(
        self,
        interfaces: List[InterfaceRecord],
    ) -> Topology:
        """
        Costruisce la topologia da una lista di InterfaceRecord.

        Algoritmo O(n) dove n = numero di interfacce:
        1. Bucket by subnet O(n)
        2. Extract links O(n)
        3. Build adjacency O(L) dove L = numero link
        4. Build IP index O(n)

        Args:
            interfaces: Lista di InterfaceRecord (solo interfacce UP con IP valido)

        Returns:
            Topology completa con indici per query efficienti
        """
        logger.info(f"Building topology from {len(interfaces)} interfaces")

        # Step 1: Filter only UP interfaces with valid IP
        active_interfaces = [
            iface for iface in interfaces
            if iface.is_up and iface.ip != 0
        ]
        logger.debug(f"Active interfaces after filtering: {len(active_interfaces)}")

        # Step 2: Bucket by subnet
        subnet_buckets = self._bucket_by_subnet(active_interfaces)
        logger.debug(f"Subnet buckets: {len(subnet_buckets)}")

        # Step 3: Extract links (only subnets with 2+ different nodes)
        links = self._extract_links(subnet_buckets)
        logger.debug(f"Links extracted: {len(links)}")

        # Step 4: Collect all nodes
        nodes: Set[str] = set()
        for link in links:
            nodes.update(link.endpoints)

        # Also add nodes from interfaces not in links (isolated nodes)
        for iface in active_interfaces:
            nodes.add(iface.node.node_key)

        logger.debug(f"Total nodes: {len(nodes)}")

        # Step 5: Build adjacency list
        adjacency = self._build_adjacency_list(links)

        # Step 6: Build IP index
        ip_to_owners = self._build_ip_index(active_interfaces, links)

        topology = Topology(
            nodes=nodes,
            links=links,
            adjacency=adjacency,
            ip_to_owners=ip_to_owners,
        )

        logger.info(
            f"Topology built: {topology.node_count} nodes, "
            f"{topology.link_count} links"
        )

        return topology

    async def build_from_firewalls(
        self,
        clients: List[Tuple[str, FirewallRepository]],
    ) -> Tuple[Topology, Dict[str, List[Any]]]:
        """
        Costruisce topologia da N firewall in parallelo.

        Args:
            clients: Lista di (device_id, FirewallRepository) tuple

        Returns:
            Tuple di (Topology, routing_tables)
            dove routing_tables e' Dict[node_key, List[Route]]
        """
        logger.info(f"Building topology from {len(clients)} firewalls")

        # Collect interfaces and routes in parallel
        all_interfaces: List[InterfaceRecord] = []
        routing_tables: Dict[str, List[Any]] = {}

        # Gather data from all firewalls
        tasks = [
            self._collect_firewall_data(device_id, client)
            for device_id, client in clients
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for (device_id, _), result in zip(clients, results):
            if isinstance(result, Exception):
                logger.error(f"Error collecting data from {device_id}: {result}")
                continue

            interfaces, routes_by_vdom = result
            all_interfaces.extend(interfaces)
            routing_tables.update(routes_by_vdom)

        # Build topology from collected interfaces
        topology = self.build_topology(all_interfaces)

        return topology, routing_tables

    def get_neighbors(
        self,
        topology: Topology,
        node: Node,
    ) -> List[Tuple[Node, Link]]:
        """
        Restituisce i vicini di un nodo.

        Args:
            topology: Topologia corrente
            node: Nodo di cui trovare i vicini

        Returns:
            Lista di (neighbor_node, link)
        """
        neighbors = topology.get_neighbors(node.node_key)
        return [
            (topology.get_node(neighbor_key), link)
            for neighbor_key, link in neighbors
            if topology.get_node(neighbor_key) is not None
        ]

    def find_node_by_ip(
        self,
        topology: Topology,
        ip_str: str,
    ) -> Optional[Tuple[Node, InterfaceRecord]]:
        """
        Cerca il nodo proprietario di un IP.

        Args:
            topology: Topologia corrente
            ip_str: IP in formato dotted-decimal

        Returns:
            (Node, InterfaceRecord) o None se non trovato
        """
        ip_int = InterfaceRecord._ip_to_int(ip_str)
        result = topology.find_node_by_ip(ip_int)

        if result is None:
            return None

        node_key, iface = result
        node = topology.get_node(node_key)
        if node is None:
            return None

        return (node, iface)

    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================

    def _bucket_by_subnet(
        self,
        interfaces: List[InterfaceRecord],
    ) -> Dict[str, List[InterfaceRecord]]:
        """
        Raggruppa interfacce per subnet (network_id).

        Complessita': O(n)

        Args:
            interfaces: Lista di interfacce

        Returns:
            Dict[network_id, List[InterfaceRecord]]
        """
        buckets: Dict[str, List[InterfaceRecord]] = defaultdict(list)

        for iface in interfaces:
            # Skip /32 (host routes) - non creano link
            if iface.prefix_len == 32:
                continue

            network_id = iface.network_id
            buckets[network_id].append(iface)

        return dict(buckets)

    def _extract_links(
        self,
        subnet_buckets: Dict[str, List[InterfaceRecord]],
    ) -> List[Link]:
        """
        Estrae link da bucket con 2+ nodi diversi.

        Complessita': O(n) totale

        Args:
            subnet_buckets: Bucket di interfacce per subnet

        Returns:
            Lista di Link
        """
        links: List[Link] = []

        for subnet, interfaces in subnet_buckets.items():
            # Estrai nodi unici
            nodes_in_bucket: Set[str] = set()
            for iface in interfaces:
                nodes_in_bucket.add(iface.node.node_key)

            # Crea link solo se 2+ nodi diversi sulla stessa subnet
            if len(nodes_in_bucket) >= 2:
                link = Link(
                    subnet=subnet,
                    endpoints=nodes_in_bucket,
                    interfaces=interfaces,
                )
                links.append(link)
                logger.debug(
                    f"Link created: {subnet} connects {len(nodes_in_bucket)} nodes"
                )

        return links

    def _build_adjacency_list(
        self,
        links: List[Link],
    ) -> Dict[str, List[Tuple[str, int]]]:
        """
        Costruisce lista di adiacenza bidirezionale.

        Per ogni link, aggiunge un arco tra ogni coppia di nodi.

        Complessita': O(L * E^2) dove L = link, E = endpoints per link
        In pratica O(L) perche' E e' tipicamente 2-3.

        Args:
            links: Lista di Link

        Returns:
            Dict[node_key, List[(neighbor_key, link_index)]]
        """
        adjacency: Dict[str, List[Tuple[str, int]]] = defaultdict(list)

        for link_idx, link in enumerate(links):
            # Per ogni coppia di nodi nel link
            endpoints = list(link.endpoints)
            for i, node_a in enumerate(endpoints):
                for node_b in endpoints[i + 1:]:
                    # Arco bidirezionale
                    adjacency[node_a].append((node_b, link_idx))
                    adjacency[node_b].append((node_a, link_idx))

        return dict(adjacency)

    def _build_ip_index(
        self,
        interfaces: List[InterfaceRecord],
        links: List[Link],
    ) -> Dict[int, List[Tuple[str, int]]]:
        """
        Costruisce reverse index IP -> (node_key, interface_index).

        Complessita': O(n)

        Args:
            interfaces: Lista di tutte le interfacce
            links: Lista di link (per trovare interface index)

        Returns:
            Dict[ip_uint32, List[(node_key, interface_index)]]
        """
        ip_to_owners: Dict[int, List[Tuple[str, int]]] = defaultdict(list)

        for iface in interfaces:
            node_key = iface.node.node_key
            # Interface index is just a placeholder, real lookup happens in Topology
            ip_to_owners[iface.ip].append((node_key, 0))

        return dict(ip_to_owners)

    async def _collect_firewall_data(
        self,
        device_id: str,
        client: FirewallRepository,
    ) -> Tuple[List[InterfaceRecord], Dict[str, List[Any]]]:
        """
        Raccoglie interfacce e rotte da un firewall.

        Args:
            device_id: ID del firewall
            client: Repository client

        Returns:
            Tuple di (interfaces, routes_by_vdom)
        """
        interfaces: List[InterfaceRecord] = []
        routes_by_vdom: Dict[str, List[Any]] = {}

        try:
            # Get VDOMs
            vdoms = await client.get_vdoms()

            for vdom in vdoms:
                vdom_name = vdom.name
                node_key = f"{device_id}:{vdom_name}"

                # Get interfaces for this VDOM
                try:
                    raw_interfaces = await client.get_interfaces(vdom=vdom_name)
                    for iface in raw_interfaces:
                        record = InterfaceRecord.from_network_interface(
                            device_id=device_id,
                            iface=iface,
                        )
                        if record is not None:
                            interfaces.append(record)
                except Exception as e:
                    logger.warning(
                        f"Error getting interfaces for {node_key}: {e}"
                    )

                # Get routes for this VDOM
                try:
                    routes = await client.get_routing_table(vdom=vdom_name)
                    routes_by_vdom[node_key] = routes
                except Exception as e:
                    logger.warning(
                        f"Error getting routes for {node_key}: {e}"
                    )
                    routes_by_vdom[node_key] = []

        except Exception as e:
            logger.error(f"Error collecting data from {device_id}: {e}")
            raise

        logger.debug(
            f"Collected from {device_id}: "
            f"{len(interfaces)} interfaces, "
            f"{len(routes_by_vdom)} vdoms with routes"
        )

        return interfaces, routes_by_vdom


# Utility functions for external use

def interfaces_from_network_interfaces(
    device_id: str,
    network_interfaces: List[NetworkInterface],
) -> List[InterfaceRecord]:
    """
    Converte lista di NetworkInterface in InterfaceRecord.

    Args:
        device_id: ID del firewall
        network_interfaces: Lista di NetworkInterface dal domain

    Returns:
        Lista di InterfaceRecord validi
    """
    records = []
    for iface in network_interfaces:
        record = InterfaceRecord.from_network_interface(
            device_id=device_id,
            iface=iface,
        )
        if record is not None:
            records.append(record)
    return records
