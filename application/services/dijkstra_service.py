"""
DIJKSTRA SERVICE - Shortest Path Calculation

Servizio per calcolare il percorso più breve nella topologia usando
l'algoritmo di Dijkstra con supporto per:
- Multi-metric costs (costo, bandwidth, latency, reliability)
- Path profiles configurabili (bulk, real-time, critical)
- ECMP (Equal-Cost Multi-Path)
- Alternative paths

Differenza da PathfinderService:
- PathfinderService: Simula forwarding reale (segue routing tables)
- DijkstraService: Calcola shortest path teorico (usa link topology)
"""

from __future__ import annotations
import logging
import heapq
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass

from application.models.topology import Node, Link, Topology
from application.models.pathfinder import PathStatus, HopResult, PathResult


logger = logging.getLogger(__name__)


@dataclass
class PathProfile:
    """
    Profilo di pathfinding con pesi per le metriche.

    Ogni profilo definisce come pesare le diverse metriche per
    calcolare il costo composito di un link.
    """

    name: str
    cost_weight: float = 0.4      # OSPF/BGP cost
    bandwidth_weight: float = 0.3  # Bandwidth (higher = better)
    latency_weight: float = 0.2    # Latency (lower = better)
    reliability_weight: float = 0.1  # Reliability (higher = better)

    def __post_init__(self):
        """Verifica che i pesi sommino a 1.0."""
        total = (
            self.cost_weight +
            self.bandwidth_weight +
            self.latency_weight +
            self.reliability_weight
        )
        if not 0.99 <= total <= 1.01:
            logger.warning(
                f"Profile '{self.name}' weights sum to {total:.2f}, "
                f"expected 1.0. Normalizing..."
            )
            # Normalize weights
            self.cost_weight /= total
            self.bandwidth_weight /= total
            self.latency_weight /= total
            self.reliability_weight /= total


# Predefined path profiles
PROFILE_BALANCED = PathProfile(
    name="balanced",
    cost_weight=0.4,
    bandwidth_weight=0.3,
    latency_weight=0.2,
    reliability_weight=0.1,
)

PROFILE_BULK = PathProfile(
    name="bulk",
    cost_weight=0.2,
    bandwidth_weight=0.6,  # Prioritize high bandwidth
    latency_weight=0.1,
    reliability_weight=0.1,
)

PROFILE_REALTIME = PathProfile(
    name="realtime",
    cost_weight=0.1,
    bandwidth_weight=0.2,
    latency_weight=0.6,  # Prioritize low latency
    reliability_weight=0.1,
)

PROFILE_CRITICAL = PathProfile(
    name="critical",
    cost_weight=0.2,
    bandwidth_weight=0.2,
    latency_weight=0.1,
    reliability_weight=0.5,  # Prioritize reliability
)

PROFILE_COST_ONLY = PathProfile(
    name="cost_only",
    cost_weight=1.0,
    bandwidth_weight=0.0,
    latency_weight=0.0,
    reliability_weight=0.0,
)


class DijkstraService:
    """
    Servizio per calcolare shortest path con Dijkstra.

    Uso:
        service = DijkstraService()
        result = service.shortest_path(
            topology=topology,
            start_node=node,
            target_ip="10.0.0.1",
            profile=PROFILE_BULK
        )
    """

    def __init__(self) -> None:
        """Inizializza il servizio."""
        self.default_profile = PROFILE_BALANCED

    def shortest_path(
        self,
        topology: Topology,
        start_node: Node,
        target_ip: str,
        profile: Optional[PathProfile] = None,
    ) -> PathResult:
        """
        Calcola il percorso più breve usando Dijkstra.

        Args:
            topology: Topologia della rete
            start_node: Nodo di partenza
            target_ip: IP destinazione
            profile: Profilo di pathfinding (default: balanced)

        Returns:
            PathResult con il percorso ottimale
        """
        if profile is None:
            profile = self.default_profile

        logger.debug(
            f"Computing shortest path from {start_node.node_key} to {target_ip} "
            f"using profile '{profile.name}'"
        )

        # Convert target IP to int
        target_ip_int = self._ip_to_int(target_ip)

        # Find target node by IP
        target_node_result = topology.find_node_by_ip(target_ip_int)
        if target_node_result is None:
            logger.debug(f"Target IP {target_ip} not in topology")
            return PathResult(
                source_node=start_node,
                target_ip=target_ip,
                hops=[],
                status=PathStatus.NO_NEIGHBOR,
            )

        target_node_key, _ = target_node_result

        # Run Dijkstra
        distances, predecessors = self._dijkstra(
            topology,
            start_node.node_key,
            profile,
        )

        # Check if target is reachable
        if target_node_key not in distances:
            logger.debug(f"No path found to {target_node_key}")
            return PathResult(
                source_node=start_node,
                target_ip=target_ip,
                hops=[],
                status=PathStatus.NO_NEIGHBOR,
            )

        # Reconstruct path
        path_nodes = self._reconstruct_path(
            predecessors,
            start_node.node_key,
            target_node_key,
        )

        # Build hops from path
        hops = self._build_hops(topology, path_nodes)

        total_cost = distances[target_node_key]

        logger.info(
            f"Found path with {len(hops)} hops, total cost: {total_cost:.2f}"
        )

        return PathResult(
            source_node=start_node,
            target_ip=target_ip,
            hops=hops,
            status=PathStatus.REACHED,
            exit_point=target_node_key,
        )

    def find_k_shortest_paths(
        self,
        topology: Topology,
        start_node: Node,
        target_ip: str,
        k: int = 3,
        profile: Optional[PathProfile] = None,
    ) -> List[PathResult]:
        """
        Trova i K percorsi più brevi (Yen's algorithm).

        Utile per visualizzare percorsi alternativi e ECMP.

        Args:
            topology: Topologia della rete
            start_node: Nodo di partenza
            target_ip: IP destinazione
            k: Numero di percorsi da trovare
            profile: Profilo di pathfinding

        Returns:
            Lista di PathResult ordinati per costo crescente
        """
        # TODO: Implementare Yen's K-shortest paths algorithm
        # Per ora restituisce solo il percorso principale
        primary = self.shortest_path(topology, start_node, target_ip, profile)
        return [primary]

    # =========================================================================
    # PRIVATE METHODS - Dijkstra Algorithm
    # =========================================================================

    def _dijkstra(
        self,
        topology: Topology,
        start_node_key: str,
        profile: PathProfile,
    ) -> Tuple[Dict[str, float], Dict[str, Optional[str]]]:
        """
        Implementazione classica dell'algoritmo di Dijkstra.

        Args:
            topology: Topologia della rete
            start_node_key: Chiave del nodo di partenza
            profile: Profilo per calcolo costo composito

        Returns:
            Tuple di (distances, predecessors):
            - distances: Dict[node_key, cost] - Distanza minima a ogni nodo
            - predecessors: Dict[node_key, parent_key] - Predecessore nel path
        """
        # Initialize data structures
        distances: Dict[str, float] = {start_node_key: 0.0}
        predecessors: Dict[str, Optional[str]] = {start_node_key: None}
        visited: Set[str] = set()

        # Priority queue: (distance, node_key)
        pq: List[Tuple[float, str]] = [(0.0, start_node_key)]

        while pq:
            current_distance, current_key = heapq.heappop(pq)

            # Skip if already visited
            if current_key in visited:
                continue

            visited.add(current_key)

            # Explore neighbors
            neighbors = topology.get_neighbors(current_key)

            for neighbor_key, link in neighbors:
                if neighbor_key in visited:
                    continue

                # Calculate link cost using profile
                link_cost = self._calculate_composite_cost(link, profile)

                # Calculate new distance
                new_distance = current_distance + link_cost

                # Update if shorter path found
                if neighbor_key not in distances or new_distance < distances[neighbor_key]:
                    distances[neighbor_key] = new_distance
                    predecessors[neighbor_key] = current_key
                    heapq.heappush(pq, (new_distance, neighbor_key))

        return distances, predecessors

    def _calculate_composite_cost(
        self,
        link: Link,
        profile: PathProfile,
    ) -> float:
        """
        Calcola il costo composito di un link usando il profilo.

        Formula:
        composite_cost = w1 * norm_cost + w2 * norm_bw + w3 * norm_lat + w4 * norm_rel

        Le metriche vengono normalizzate in [0, 1] dove:
        - 0 = migliore
        - 1 = peggiore

        Args:
            link: Link da valutare
            profile: Profilo con pesi per le metriche

        Returns:
            Costo composito (float)
        """
        # Normalize cost (0-100 range assumed)
        norm_cost = link.cost / 100.0 if link.cost else 0.0

        # Normalize bandwidth (invert: high bandwidth = low cost)
        # Assume 100 Gbps = best (100000 Mbps)
        if link.bandwidth_mbps:
            norm_bw = 1.0 - min(link.bandwidth_mbps / 100000.0, 1.0)
        else:
            norm_bw = 0.5  # Unknown bandwidth = medium cost

        # Normalize latency (assume 10ms = worst)
        if link.latency_ms:
            norm_lat = min(link.latency_ms / 10.0, 1.0)
        else:
            norm_lat = 0.5  # Unknown latency = medium cost

        # Normalize reliability (invert: high reliability = low cost)
        if link.reliability:
            norm_rel = 1.0 - link.reliability
        else:
            norm_rel = 0.5  # Unknown reliability = medium cost

        # Calculate weighted sum
        composite = (
            profile.cost_weight * norm_cost +
            profile.bandwidth_weight * norm_bw +
            profile.latency_weight * norm_lat +
            profile.reliability_weight * norm_rel
        )

        # Add small epsilon to avoid zero costs (causes issues in Dijkstra)
        return max(composite, 0.001)

    def _reconstruct_path(
        self,
        predecessors: Dict[str, Optional[str]],
        start_key: str,
        target_key: str,
    ) -> List[str]:
        """
        Ricostruisce il percorso dai predecessori.

        Args:
            predecessors: Dict di predecessori da Dijkstra
            start_key: Nodo di partenza
            target_key: Nodo di destinazione

        Returns:
            Lista di node_keys dal start al target
        """
        path = []
        current = target_key

        while current is not None:
            path.append(current)
            current = predecessors.get(current)

        path.reverse()

        # Verify path starts with start_key
        if path[0] != start_key:
            logger.warning(
                f"Path reconstruction error: expected start {start_key}, "
                f"got {path[0]}"
            )

        return path

    def _build_hops(
        self,
        topology: Topology,
        path_nodes: List[str],
    ) -> List[HopResult]:
        """
        Costruisce lista di HopResult da path di nodi.

        Args:
            topology: Topologia della rete
            path_nodes: Lista di node_keys nel percorso

        Returns:
            Lista di HopResult
        """
        hops = []

        for i, node_key in enumerate(path_nodes):
            node = topology.get_node(node_key)
            if node is None:
                logger.warning(f"Node {node_key} not found in topology")
                continue

            # Determine egress interface and next hop
            egress_interface = None
            next_hop_ip = None

            if i < len(path_nodes) - 1:
                # Not the last node - find link to next node
                next_node_key = path_nodes[i + 1]
                neighbors = topology.get_neighbors(node_key)

                for neighbor_key, link in neighbors:
                    if neighbor_key == next_node_key:
                        egress_interface = link.source_interface
                        next_hop_ip = link.target_ip
                        break

            hop = HopResult(
                node=node,
                ingress_interface=None,  # TODO: Track ingress from previous hop
                egress_interface=egress_interface,
                action="forward" if i < len(path_nodes) - 1 else "connected",
                next_hop_ip=next_hop_ip,
            )
            hops.append(hop)

        return hops

    @staticmethod
    def _ip_to_int(ip_str: str) -> int:
        """Converte dotted-decimal IP in uint32."""
        import ipaddress
        return int(ipaddress.IPv4Address(ip_str))
