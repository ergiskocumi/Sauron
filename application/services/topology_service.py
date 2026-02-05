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
        routing_tables: Optional[Dict[str, List[Any]]] = None,
    ) -> Topology:
        """
        Costruisce la topologia da interfacce e routing tables.

        Se routing_tables e' fornito, usa next-hop relationships (PREFERITO).
        Altrimenti fallback a subnet bucketing (LEGACY).

        Algoritmo con routing tables O(R + I) dove R = routes, I = interfaces:
        1. Build IP index O(I)
        2. Extract links from routes O(R)
        3. Build adjacency O(L) dove L = numero link

        Args:
            interfaces: Lista di InterfaceRecord (solo interfacce UP con IP valido)
            routing_tables: Dict[node_key, List[Route]] (opzionale)

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

        # Step 2: Build IP index (needed for next-hop lookup)
        ip_to_owners = self._build_ip_index(active_interfaces, [])

        # Step 3: Extract links
        if routing_tables:
            logger.info("Using ROUTING TABLE based topology (next-hop)")
            links = self._extract_links_from_routing_tables(
                routing_tables,
                active_interfaces,
                ip_to_owners,
            )
        else:
            logger.warning("Using LEGACY SUBNET BUCKETING (full mesh)")
            subnet_buckets = self._bucket_by_subnet(active_interfaces)
            links = self._extract_links_legacy(subnet_buckets)

        logger.debug(f"Links extracted: {len(links)}")

        # Step 4: Collect all nodes
        nodes: Set[str] = set()
        for link in links:
            nodes.add(link.source)
            nodes.add(link.target)

        # Also add nodes from interfaces not in links (isolated nodes)
        for iface in active_interfaces:
            nodes.add(iface.node.node_key)

        logger.debug(f"Total nodes: {len(nodes)}")

        # Step 5: Build adjacency list
        adjacency = self._build_adjacency_list(links)

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

        # Build topology from collected interfaces with routing tables
        topology = self.build_topology(all_interfaces, routing_tables)

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

    def _extract_links_from_routing_tables(
        self,
        routing_tables: Dict[str, List[Any]],
        interfaces: List[InterfaceRecord],
        ip_to_owners: Dict[int, List[Tuple[str, int]]],
    ) -> List[Link]:
        """
        Estrae link basati su next-hop relationships dalle routing tables.

        Algoritmo:
        1. Per ogni nodo, leggi le sue routes
        2. Per ogni route con gateway != 0.0.0.0:
           a. Cerca il nodo proprietario del gateway IP
           b. Se trovato, crea link diretto source -> target
        3. Deduplica link identici

        Args:
            routing_tables: Dict[node_key, List[Route]]
            interfaces: Lista di interfacce (per trovare subnet)
            ip_to_owners: IP index per lookup veloce

        Returns:
            Lista di Link diretti con metriche
        """
        links: List[Link] = []
        seen_links: Set[Tuple[str, str, str]] = set()  # (source, target, subnet)

        # Build interface lookup by node and name
        iface_lookup: Dict[Tuple[str, str], InterfaceRecord] = {}
        for iface in interfaces:
            key = (iface.node.node_key, iface.iface_name)
            iface_lookup[key] = iface

        for source_node_key, routes in routing_tables.items():
            for route in routes:
                # Skip routes without gateway (local/connected)
                if route.gateway == "0.0.0.0":
                    continue

                # Find target node by gateway IP
                try:
                    gateway_ip_int = InterfaceRecord._ip_to_int(route.gateway)
                except (ValueError, Exception):
                    logger.debug(f"Invalid gateway IP: {route.gateway}")
                    continue

                # Lookup target node
                if gateway_ip_int not in ip_to_owners:
                    # Gateway not found in topology (external network)
                    continue

                target_candidates = ip_to_owners[gateway_ip_int]
                if not target_candidates:
                    continue

                target_node_key = target_candidates[0][0]

                # Find source interface for this route
                source_iface_key = (source_node_key, route.interface)
                if source_iface_key not in iface_lookup:
                    logger.debug(
                        f"Interface {route.interface} not found for {source_node_key}"
                    )
                    continue

                source_iface = iface_lookup[source_iface_key]
                subnet = source_iface.network_id

                # Deduplicate: same source, target, subnet
                link_signature = (source_node_key, target_node_key, subnet)
                if link_signature in seen_links:
                    continue
                seen_links.add(link_signature)

                # Calculate link metrics
                bandwidth_mbps = source_iface.bandwidth_mbps
                latency_ms = source_iface.estimated_latency_ms
                reliability = source_iface.reliability_score

                # Create directed link with enriched metrics
                link = Link(
                    source=source_node_key,
                    target=target_node_key,
                    subnet=subnet,
                    source_interface=route.interface,
                    target_ip=route.gateway,
                    cost=route.metric,
                    protocol=route.protocol,
                    distance=route.distance,
                    bandwidth_mbps=bandwidth_mbps,
                    latency_ms=latency_ms,
                    reliability=reliability,
                    interfaces=[source_iface],
                )
                links.append(link)
                logger.debug(
                    f"Link: {source_node_key} -> {target_node_key} "
                    f"via {subnet} (cost={route.metric}, proto={route.protocol}, "
                    f"bw={bandwidth_mbps}Mbps, lat={latency_ms:.2f}ms, rel={reliability:.2f})"
                )

        return links

    def _extract_links_legacy(
        self,
        subnet_buckets: Dict[str, List[InterfaceRecord]],
    ) -> List[Link]:
        """
        Estrae link da bucket con 2+ nodi diversi (LEGACY FULL MESH).

        DEPRECATO: Usa _extract_links_from_routing_tables() invece.

        Complessita': O(n) totale

        Args:
            subnet_buckets: Bucket di interfacce per subnet

        Returns:
            Lista di Link (convertiti in formato directed)
        """
        links: List[Link] = []

        for subnet, interfaces in subnet_buckets.items():
            # Estrai nodi unici
            nodes_in_bucket: Set[str] = set()
            for iface in interfaces:
                nodes_in_bucket.add(iface.node.node_key)

            # Crea link solo se 2+ nodi diversi sulla stessa subnet
            if len(nodes_in_bucket) >= 2:
                # Create pairwise links (full mesh)
                node_list = list(nodes_in_bucket)
                for i in range(len(node_list)):
                    for j in range(i + 1, len(node_list)):
                        source = node_list[i]
                        target = node_list[j]

                        # Find interfaces for source and target
                        source_iface = next(
                            (iface for iface in interfaces if iface.node.node_key == source),
                            None
                        )
                        target_iface = next(
                            (iface for iface in interfaces if iface.node.node_key == target),
                            None
                        )

                        if source_iface and target_iface:
                            # Create bidirectional links with metrics
                            links.append(Link(
                                source=source,
                                target=target,
                                subnet=subnet,
                                source_interface=source_iface.iface_name,
                                target_ip=target_iface.ip_str,
                                cost=1,
                                protocol="connected",
                                distance=0,
                                bandwidth_mbps=source_iface.bandwidth_mbps,
                                latency_ms=source_iface.estimated_latency_ms,
                                reliability=source_iface.reliability_score,
                                interfaces=[source_iface, target_iface],
                            ))
                            links.append(Link(
                                source=target,
                                target=source,
                                subnet=subnet,
                                source_interface=target_iface.iface_name,
                                target_ip=source_iface.ip_str,
                                cost=1,
                                protocol="connected",
                                distance=0,
                                bandwidth_mbps=target_iface.bandwidth_mbps,
                                latency_ms=target_iface.estimated_latency_ms,
                                reliability=target_iface.reliability_score,
                                interfaces=[target_iface, source_iface],
                            ))

                logger.debug(
                    f"Legacy links: {subnet} connects {len(nodes_in_bucket)} nodes"
                )

        return links

    def _build_adjacency_list(
        self,
        links: List[Link],
    ) -> Dict[str, List[Tuple[str, int]]]:
        """
        Costruisce lista di adiacenza da link diretti.

        Per ogni link source -> target, aggiunge un arco nell'adjacency list.

        Complessita': O(L) dove L = numero link

        Args:
            links: Lista di Link diretti

        Returns:
            Dict[node_key, List[(neighbor_key, link_index)]]
        """
        adjacency: Dict[str, List[Tuple[str, int]]] = defaultdict(list)

        for link_idx, link in enumerate(links):
            # Directed edge: source -> target
            adjacency[link.source].append((link.target, link_idx))

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
