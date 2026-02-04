"""
PATHFINDER MODELS - Strutture per simulazione percorsi

Modelli Pydantic per rappresentare:
- PathStatus: Stato finale del percorso
- HopResult: Singolo hop nel percorso
- PathResult: Risultato completo del pathfinding
"""

from __future__ import annotations
from enum import Enum
from typing import List, Optional, Any
from pydantic import BaseModel, Field

from application.models.topology import Node


class PathStatus(str, Enum):
    """
    Stato finale del percorso simulato.

    Valori:
    - REACHED: Il pacchetto ha raggiunto la destinazione
    - DROPPED: Il pacchetto e' stato droppato (no route, blackhole)
    - LOOP: Rilevato loop di routing
    - TTL_EXCEEDED: TTL esaurito prima di raggiungere la destinazione
    - EXIT_WAN: Il pacchetto esce verso un gateway non in topology (WAN)
    - NO_NEIGHBOR: Gateway non raggiungibile nella topology
    """

    REACHED = "reached"
    DROPPED = "dropped"
    LOOP = "loop"
    TTL_EXCEEDED = "ttl_exceeded"
    EXIT_WAN = "exit_wan"
    NO_NEIGHBOR = "no_neighbor"

    @property
    def is_success(self) -> bool:
        """True se il pacchetto ha raggiunto la destinazione."""
        return self == PathStatus.REACHED

    @property
    def is_failure(self) -> bool:
        """True se il pacchetto non ha raggiunto la destinazione."""
        return self != PathStatus.REACHED


class HopResult(BaseModel):
    """
    Singolo hop nel percorso simulato.

    Rappresenta il passaggio del pacchetto attraverso un nodo,
    includendo le decisioni di routing prese.
    """

    node: Node = Field(
        ...,
        description="Nodo attraversato"
    )
    ingress_interface: Optional[str] = Field(
        None,
        description="Interfaccia di ingresso (None per il primo hop)"
    )
    egress_interface: Optional[str] = Field(
        None,
        description="Interfaccia di uscita"
    )
    matched_route_destination: Optional[str] = Field(
        None,
        description="Destinazione della rotta matchata (es. '10.0.0.0/8')"
    )
    matched_route_gateway: Optional[str] = Field(
        None,
        description="Gateway della rotta matchata"
    )
    matched_route_protocol: Optional[str] = Field(
        None,
        description="Protocollo della rotta (static, ospf, connected)"
    )
    action: str = Field(
        ...,
        description="Azione presa: 'forward', 'connected', 'drop', 'exit_wan'"
    )
    next_hop_ip: Optional[str] = Field(
        None,
        description="IP del next-hop (se forward)"
    )

    @property
    def is_terminal(self) -> bool:
        """True se questo hop termina il percorso."""
        return self.action in ("connected", "drop", "exit_wan")

    @property
    def matched_route_summary(self) -> str:
        """Riassunto della rotta matchata."""
        if not self.matched_route_destination:
            return "no route"
        gw = self.matched_route_gateway or "direct"
        return f"{self.matched_route_destination} via {gw}"

    def __repr__(self) -> str:
        return (
            f"Hop({self.node.node_key}, "
            f"egress={self.egress_interface}, "
            f"action={self.action})"
        )

    model_config = {
        "str_strip_whitespace": True,
    }


class PathResult(BaseModel):
    """
    Risultato completo del pathfinding.

    Contiene la sequenza di hop e lo stato finale del percorso.
    """

    source_node: Node = Field(
        ...,
        description="Nodo di partenza"
    )
    target_ip: str = Field(
        ...,
        description="IP destinazione richiesto"
    )
    hops: List[HopResult] = Field(
        default_factory=list,
        description="Sequenza di hop nel percorso"
    )
    status: PathStatus = Field(
        ...,
        description="Stato finale del percorso"
    )
    exit_point: Optional[str] = Field(
        None,
        description="Punto di uscita (node_key) se EXIT_WAN o REACHED"
    )
    exit_interface: Optional[str] = Field(
        None,
        description="Interfaccia di uscita finale"
    )
    exit_gateway: Optional[str] = Field(
        None,
        description="Gateway di uscita (per EXIT_WAN)"
    )

    @property
    def total_hops(self) -> int:
        """Numero totale di hop nel percorso."""
        return len(self.hops)

    @property
    def is_reachable(self) -> bool:
        """True se la destinazione e' raggiungibile."""
        return self.status == PathStatus.REACHED

    @property
    def path_nodes(self) -> List[str]:
        """Lista di node_keys attraversati."""
        return [hop.node.node_key for hop in self.hops]

    @property
    def failure_reason(self) -> Optional[str]:
        """Descrizione del motivo di fallimento."""
        if self.status == PathStatus.REACHED:
            return None

        reasons = {
            PathStatus.DROPPED: "No route to destination or blackhole",
            PathStatus.LOOP: "Routing loop detected",
            PathStatus.TTL_EXCEEDED: "TTL exceeded (max hops reached)",
            PathStatus.EXIT_WAN: f"Packet exits via WAN gateway {self.exit_gateway}",
            PathStatus.NO_NEIGHBOR: "Gateway not reachable in topology",
        }
        return reasons.get(self.status, "Unknown failure")

    def format_path(self) -> str:
        """Formatta il percorso in modo leggibile."""
        if not self.hops:
            return f"[{self.source_node.node_key}] -> {self.target_ip}: {self.status.value}"

        path_str = " -> ".join(hop.node.node_key for hop in self.hops)
        return f"{path_str} -> {self.target_ip}: {self.status.value}"

    def __repr__(self) -> str:
        return (
            f"PathResult(from={self.source_node.node_key}, "
            f"to={self.target_ip}, "
            f"hops={self.total_hops}, "
            f"status={self.status.value})"
        )

    model_config = {
        "str_strip_whitespace": True,
    }
