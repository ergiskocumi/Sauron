"""
PATHFINDER SERVICE - Simulazione percorso pacchetti

Servizio per simulare il percorso di un pacchetto attraverso la rete
usando Longest Prefix Match (LPM) e le routing table dei firewall.

Algoritmo State Machine:
1. Controlla loop (visited set)
2. Controlla TTL
3. Verifica se IP locale
4. LPM lookup sulla routing table
5. Decision: connected/forward/drop/exit_wan
6. Transizione al next-hop
"""

from __future__ import annotations
import logging
import ipaddress
from typing import Dict, List, Optional, Set, Tuple, Any

from application.models.topology import Node, InterfaceRecord, Link, Topology
from application.models.pathfinder import PathStatus, HopResult, PathResult
from domain.models import Route


logger = logging.getLogger(__name__)


class PathfinderService:
    """
    Servizio per simulare il percorso dei pacchetti nella rete.

    Uso:
        service = PathfinderService()
        result = service.find_path(
            topology=topology,
            routing_tables=routing_tables,
            start_node=node,
            target_ip="10.0.0.1"
        )
    """

    def __init__(self) -> None:
        """Inizializza il servizio."""
        pass

    # =========================================================================
    # PUBLIC METHODS
    # =========================================================================

    def find_path(
        self,
        topology: Topology,
        routing_tables: Dict[str, List[Route]],
        start_node: Node,
        target_ip: str,
        max_ttl: int = 64,
        initial_ingress: Optional[str] = None,
    ) -> PathResult:
        """
        Simula il percorso di un pacchetto dalla sorgente alla destinazione.

        Implementa una state machine che:
        1. Esegue LPM lookup sulla routing table del nodo corrente
        2. Decide l'azione (forward, connected, drop, exit_wan)
        3. Transita al next-hop se necessario
        4. Rileva loop e TTL exceeded

        Args:
            topology: Topologia della rete
            routing_tables: Dict[node_key, List[Route]]
            start_node: Nodo di partenza
            target_ip: IP destinazione (dotted-decimal)
            max_ttl: Massimo numero di hop (default 64)

        Returns:
            PathResult con hops, status e informazioni sul percorso
        """
        logger.debug(
            f"Finding path from {start_node.node_key} to {target_ip}"
        )

        # Convert target IP to int for comparisons
        target_ip_int = self._ip_to_int(target_ip)

        # State machine variables
        current_node = start_node
        visited: Set[str] = set()
        ttl = max_ttl
        hops: List[HopResult] = []
        ingress_interface: Optional[str] = initial_ingress

        while ttl > 0:
            node_key = current_node.node_key

            # 1. LOOP CHECK
            if node_key in visited:
                logger.debug(f"Loop detected at {node_key}")
                return PathResult(
                    source_node=start_node,
                    target_ip=target_ip,
                    hops=hops,
                    status=PathStatus.LOOP,
                    exit_point=node_key,
                )

            visited.add(node_key)
            ttl -= 1

            # 2. CHECK IF TARGET IS LOCAL (on this node's interface)
            local_check = self._check_if_local(
                topology, current_node, target_ip_int
            )
            if local_check is not None:
                iface_name, is_self = local_check
                hop = HopResult(
                    node=current_node,
                    ingress_interface=ingress_interface,
                    egress_interface=iface_name,
                    action="connected" if not is_self else "local",
                )
                hops.append(hop)

                return PathResult(
                    source_node=start_node,
                    target_ip=target_ip,
                    hops=hops,
                    status=PathStatus.REACHED,
                    exit_point=node_key,
                    exit_interface=iface_name,
                )

            # 3. LPM LOOKUP
            routes = routing_tables.get(node_key, [])
            if not routes:
                logger.debug(f"No routing table for {node_key}")
                hop = HopResult(
                    node=current_node,
                    ingress_interface=ingress_interface,
                    egress_interface=None,
                    action="drop",
                )
                hops.append(hop)

                return PathResult(
                    source_node=start_node,
                    target_ip=target_ip,
                    hops=hops,
                    status=PathStatus.DROPPED,
                    exit_point=node_key,
                )

            matched_route = self._longest_prefix_match(routes, target_ip_int)

            if matched_route is None:
                logger.debug(f"No route to {target_ip} from {node_key}")
                hop = HopResult(
                    node=current_node,
                    ingress_interface=ingress_interface,
                    egress_interface=None,
                    action="drop",
                )
                hops.append(hop)

                return PathResult(
                    source_node=start_node,
                    target_ip=target_ip,
                    hops=hops,
                    status=PathStatus.DROPPED,
                    exit_point=node_key,
                )

            # 4. DECISION BASED ON ROUTE TYPE
            logger.debug(
                f"Matched route: {matched_route.destination} "
                f"via {matched_route.gateway} ({matched_route.protocol})"
            )

            # Case A: Connected route - target is on directly attached network
            if matched_route.protocol == "connected":
                hop = HopResult(
                    node=current_node,
                    ingress_interface=ingress_interface,
                    egress_interface=matched_route.interface,
                    matched_route_destination=matched_route.destination,
                    matched_route_gateway=matched_route.gateway,
                    matched_route_protocol=matched_route.protocol,
                    action="connected",
                )
                hops.append(hop)

                return PathResult(
                    source_node=start_node,
                    target_ip=target_ip,
                    hops=hops,
                    status=PathStatus.REACHED,
                    exit_point=node_key,
                    exit_interface=matched_route.interface,
                )

            # Case B: Gateway route - need to forward to next-hop
            gateway_ip = matched_route.gateway

            # Check if it's a valid gateway (not 0.0.0.0)
            if gateway_ip == "0.0.0.0" or not gateway_ip:
                # Direct delivery via interface
                hop = HopResult(
                    node=current_node,
                    ingress_interface=ingress_interface,
                    egress_interface=matched_route.interface,
                    matched_route_destination=matched_route.destination,
                    matched_route_gateway=matched_route.gateway,
                    matched_route_protocol=matched_route.protocol,
                    action="connected",
                )
                hops.append(hop)

                return PathResult(
                    source_node=start_node,
                    target_ip=target_ip,
                    hops=hops,
                    status=PathStatus.REACHED,
                    exit_point=node_key,
                    exit_interface=matched_route.interface,
                )

            # 5. RESOLVE GATEWAY TO NEXT NODE
            gateway_ip_int = self._ip_to_int(gateway_ip)
            next_node_result = self._resolve_gateway(
                topology, current_node, gateway_ip_int, matched_route.interface
            )

            if next_node_result is None:
                # Gateway not in topology - check if it's a default route
                is_default = matched_route.is_default_route

                hop = HopResult(
                    node=current_node,
                    ingress_interface=ingress_interface,
                    egress_interface=matched_route.interface,
                    matched_route_destination=matched_route.destination,
                    matched_route_gateway=gateway_ip,
                    matched_route_protocol=matched_route.protocol,
                    action="exit_wan" if is_default else "drop",
                    next_hop_ip=gateway_ip,
                )
                hops.append(hop)

                status = PathStatus.EXIT_WAN if is_default else PathStatus.NO_NEIGHBOR

                return PathResult(
                    source_node=start_node,
                    target_ip=target_ip,
                    hops=hops,
                    status=status,
                    exit_point=node_key,
                    exit_interface=matched_route.interface,
                    exit_gateway=gateway_ip,
                )

            # 6. RECORD HOP AND TRANSITION
            next_node, next_ingress = next_node_result

            hop = HopResult(
                node=current_node,
                ingress_interface=ingress_interface,
                egress_interface=matched_route.interface,
                matched_route_destination=matched_route.destination,
                matched_route_gateway=gateway_ip,
                matched_route_protocol=matched_route.protocol,
                action="forward",
                next_hop_ip=gateway_ip,
            )
            hops.append(hop)

            # Transition to next node
            current_node = next_node
            ingress_interface = next_ingress

        # TTL EXCEEDED
        logger.debug(f"TTL exceeded after {max_ttl} hops")
        return PathResult(
            source_node=start_node,
            target_ip=target_ip,
            hops=hops,
            status=PathStatus.TTL_EXCEEDED,
        )

    def trace_all_paths(
        self,
        topology: Topology,
        routing_tables: Dict[str, List[Route]],
        start_node: Node,
        target_ip: str,
        follow_ecmp: bool = False,
    ) -> List[PathResult]:
        """
        Trova tutti i path possibili (per ECMP).

        Nota: Implementazione base che restituisce solo il path principale.
        ECMP richiede estensione per seguire tutte le equal-cost routes.

        Args:
            topology: Topologia della rete
            routing_tables: Dict[node_key, List[Route]]
            start_node: Nodo di partenza
            target_ip: IP destinazione
            follow_ecmp: Se True, segue anche route ECMP (non implementato)

        Returns:
            Lista di PathResult (attualmente 1 solo path)
        """
        # Base implementation: single path
        primary_path = self.find_path(
            topology=topology,
            routing_tables=routing_tables,
            start_node=start_node,
            target_ip=target_ip,
        )

        return [primary_path]

    # =========================================================================
    # PRIVATE METHODS
    # =========================================================================

    def _longest_prefix_match(
        self,
        routes: List[Route],
        target_ip: int,
    ) -> Optional[Route]:
        """
        Trova la rotta con prefix piu' lungo che contiene target_ip.

        Ordina le rotte per prefix length DESC e restituisce la prima match.
        Complessita': O(R log R) per sort + O(R) per search = O(R log R)

        Ottimizzazione futura: Patricia Trie per O(32) = O(1)

        Args:
            routes: Lista di Route
            target_ip: IP target come uint32

        Returns:
            Route matchata o None
        """
        # Sort routes by prefix length DESC (longest first)
        # Parse destination to get prefix length
        sorted_routes = sorted(
            routes,
            key=lambda r: self._get_prefix_len(r.destination),
            reverse=True,
        )

        for route in sorted_routes:
            if self._ip_in_subnet(target_ip, route.destination):
                return route

        return None

    def _ip_in_subnet(self, ip: int, subnet_cidr: str) -> bool:
        """
        Verifica se un IP appartiene a una subnet.

        Args:
            ip: IP come uint32
            subnet_cidr: Subnet in formato CIDR (es. '10.0.0.0/8')

        Returns:
            True se IP e' nella subnet
        """
        try:
            network = ipaddress.IPv4Network(subnet_cidr, strict=False)
            return ipaddress.IPv4Address(ip) in network
        except (ValueError, ipaddress.AddressValueError):
            return False

    def _get_prefix_len(self, destination: str) -> int:
        """
        Estrae prefix length da una destinazione CIDR.

        Args:
            destination: Formato CIDR (es. '10.0.0.0/8')

        Returns:
            Prefix length (0-32)
        """
        try:
            if "/" in destination:
                return int(destination.split("/")[1])
            return 32  # Host route
        except (ValueError, IndexError):
            return 0

    def _check_if_local(
        self,
        topology: Topology,
        node: Node,
        target_ip: int,
    ) -> Optional[Tuple[str, bool]]:
        """
        Verifica se target_ip e' un IP locale del nodo.

        Args:
            topology: Topologia
            node: Nodo corrente
            target_ip: IP target come uint32

        Returns:
            (interface_name, is_self) o None se non locale
            is_self=True se l'IP e' proprio del nodo
        """
        # Check if any interface of this node has this IP
        for link in topology.links:
            for iface in link.interfaces:
                if iface.node.node_key == node.node_key:
                    if iface.ip == target_ip:
                        return (iface.iface_name, True)

        return None

    def _resolve_gateway(
        self,
        topology: Topology,
        current_node: Node,
        gateway_ip: int,
        egress_interface: str,
    ) -> Optional[Tuple[Node, str]]:
        """
        Risolve un gateway IP al nodo corrispondente nella topology.

        Cerca tra i vicini del nodo corrente chi possiede il gateway IP.

        Args:
            topology: Topologia
            current_node: Nodo corrente
            gateway_ip: IP del gateway come uint32
            egress_interface: Nome interfaccia di uscita

        Returns:
            (next_node, ingress_interface) o None se non trovato
        """
        node_key = current_node.node_key

        # Get neighbors
        neighbors = topology.get_neighbors(node_key)

        for neighbor_key, link in neighbors:
            # Check if gateway IP belongs to any interface in this link
            for iface in link.interfaces:
                if iface.ip == gateway_ip and iface.node.node_key == neighbor_key:
                    neighbor_node = topology.get_node(neighbor_key)
                    if neighbor_node is not None:
                        return (neighbor_node, iface.iface_name)

        # Gateway not found among neighbors - might be external
        return None

    @staticmethod
    def _ip_to_int(ip_str: str) -> int:
        """Converte dotted-decimal IP in uint32."""
        return int(ipaddress.IPv4Address(ip_str))

    @staticmethod
    def _int_to_ip(ip_int: int) -> str:
        """Converte uint32 in dotted-decimal IP."""
        return str(ipaddress.IPv4Address(ip_int))
