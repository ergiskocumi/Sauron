"""
TOPOLOGY MODELS - Strutture per il grafo di rete

Modelli Pydantic per rappresentare:
- Node: Nodo del grafo (Device, VDOM)
- InterfaceRecord: Interfaccia arricchita per topology building
- Link: Arco del grafo (subnet condivisa)
- Topology: Grafo completo con indici per lookup rapidi
"""

from __future__ import annotations
from typing import Dict, List, Optional, Set, Tuple, Any
from pydantic import BaseModel, Field, model_validator
import ipaddress


class Node(BaseModel):
    """
    Nodo del grafo: rappresenta un (Device, VDOM).

    Un nodo e' univocamente identificato dalla combinazione di device_id e vdom.
    Supporta hashing per uso in Set e Dict.
    """

    device_id: str = Field(
        ...,
        description="ID univoco del firewall (es. 'fw-milano')"
    )
    vdom: str = Field(
        ...,
        description="Virtual Domain (es. 'root', 'production')"
    )

    def __hash__(self) -> int:
        """Hash basato su device_id:vdom per uso in Set/Dict."""
        return hash(self.node_key)

    def __eq__(self, other: object) -> bool:
        """Due nodi sono uguali se hanno stesso device_id e vdom."""
        if not isinstance(other, Node):
            return NotImplemented
        return self.device_id == other.device_id and self.vdom == other.vdom

    @property
    def node_key(self) -> str:
        """Chiave canonica per il nodo (es. 'fw-milano:root')."""
        return f"{self.device_id}:{self.vdom}"

    def __repr__(self) -> str:
        return f"Node({self.node_key})"

    model_config = {
        "frozen": True,  # Immutabile per hashability
    }


class InterfaceRecord(BaseModel):
    """
    Record interfaccia arricchito per topology building.

    Converte gli IP in formato uint32 per operazioni bit-level efficienti
    (subnet calculation, LPM matching).
    """

    device_id: str = Field(
        ...,
        description="ID del firewall proprietario"
    )
    vdom: str = Field(
        ...,
        description="VDOM di appartenenza"
    )
    iface_name: str = Field(
        ...,
        description="Nome interfaccia (es. 'VLAN10', 'port1')"
    )
    ip: int = Field(
        ...,
        description="Indirizzo IP come uint32 per operazioni bit"
    )
    prefix_len: int = Field(
        ...,
        ge=0,
        le=32,
        description="Lunghezza prefisso CIDR (es. 24 per /24)"
    )
    is_up: bool = Field(
        ...,
        description="Stato operativo dell'interfaccia"
    )
    bandwidth_mbps: Optional[int] = Field(
        None,
        description="Bandwidth in Mbps (es. 1000, 10000, 100000)"
    )
    interface_type: Optional[str] = Field(
        None,
        description="Tipo interfaccia (physical, vlan, tunnel, hard-switch)"
    )

    @property
    def network_id(self) -> str:
        """
        Canonical network ID (es. '192.168.1.0/24').

        Calcola l'indirizzo di rete applicando la maschera all'IP.
        """
        mask = self._prefix_to_mask(self.prefix_len)
        network_ip = self.ip & mask
        return f"{self._int_to_ip(network_ip)}/{self.prefix_len}"

    @property
    def network_int(self) -> int:
        """Indirizzo di rete come uint32."""
        mask = self._prefix_to_mask(self.prefix_len)
        return self.ip & mask

    @property
    def ip_str(self) -> str:
        """IP in formato stringa dotted-decimal."""
        return self._int_to_ip(self.ip)

    @property
    def node(self) -> Node:
        """Restituisce il Node associato a questa interfaccia."""
        return Node(device_id=self.device_id, vdom=self.vdom)

    @property
    def estimated_latency_ms(self) -> float:
        """
        Stima la latenza dell'interfaccia in millisecondi.

        Basato su tipo interfaccia:
        - physical: 0.1ms (switching L2)
        - vlan: 0.1ms (tagging overhead minimo)
        - tunnel (IPsec, GRE): 1.0ms (encryption overhead)
        - hard-switch: 0.05ms (hardware switching)
        """
        if not self.interface_type:
            return 0.1  # Default

        type_lower = self.interface_type.lower()
        if "tunnel" in type_lower or "ipsec" in type_lower:
            return 1.0
        elif "hard-switch" in type_lower:
            return 0.05
        elif "vlan" in type_lower:
            return 0.1
        elif "physical" in type_lower:
            return 0.1
        else:
            return 0.1

    @property
    def reliability_score(self) -> float:
        """
        Calcola un punteggio di affidabilità (0.0 - 1.0).

        Basato su:
        - Stato operativo (is_up)
        - Tipo interfaccia (physical > vlan > tunnel)
        """
        if not self.is_up:
            return 0.0

        # Base reliability by type
        if not self.interface_type:
            return 0.95

        type_lower = self.interface_type.lower()
        if "physical" in type_lower:
            return 0.99
        elif "vlan" in type_lower:
            return 0.98
        elif "hard-switch" in type_lower:
            return 0.99
        elif "tunnel" in type_lower:
            return 0.95  # Tunnels can be less reliable
        else:
            return 0.95

    @staticmethod
    def _prefix_to_mask(prefix_len: int) -> int:
        """Converte prefix length in subnet mask uint32."""
        if prefix_len == 0:
            return 0
        return (0xFFFFFFFF << (32 - prefix_len)) & 0xFFFFFFFF

    @staticmethod
    def _int_to_ip(ip_int: int) -> str:
        """Converte uint32 in dotted-decimal string."""
        return str(ipaddress.IPv4Address(ip_int))

    @staticmethod
    def _ip_to_int(ip_str: str) -> int:
        """Converte dotted-decimal string in uint32."""
        return int(ipaddress.IPv4Address(ip_str))

    @classmethod
    def from_network_interface(
        cls,
        device_id: str,
        iface: Any,  # NetworkInterface from domain.models
    ) -> Optional["InterfaceRecord"]:
        """
        Factory method per creare InterfaceRecord da NetworkInterface.

        Args:
            device_id: ID del firewall
            iface: NetworkInterface dal domain layer

        Returns:
            InterfaceRecord o None se l'interfaccia non ha IP valido
        """
        # Skip interfacce senza IP
        if not iface.ip or iface.ip == "0.0.0.0":
            return None

        try:
            ip_int = cls._ip_to_int(iface.ip)
        except (ValueError, ipaddress.AddressValueError):
            return None

        # Calcola prefix length dalla maschera
        prefix_len = 0
        if iface.mask:
            try:
                # Usa il metodo statico della classe NetworkInterface se disponibile
                octets = [int(x) for x in iface.mask.split(".")]
                binary = "".join(format(octet, "08b") for octet in octets)
                prefix_len = binary.count("1")
            except (ValueError, AttributeError):
                prefix_len = 32  # Host route se maschera non parsabile
        else:
            prefix_len = 32  # Host route se maschera assente

        return cls(
            device_id=device_id,
            vdom=iface.vdom,
            iface_name=iface.name,
            ip=ip_int,
            prefix_len=prefix_len,
            is_up=iface.is_up,
            bandwidth_mbps=iface.bandwidth_mbps,
            interface_type=iface.type,
        )

    model_config = {
        "str_strip_whitespace": True,
    }


class Link(BaseModel):
    """
    Arco del grafo: connessione tra nodi basata su next-hop routing.

    Un link rappresenta una connessione diretta tra due nodi come risulta
    dalle routing table (next-hop relationship).
    """

    source: str = Field(
        ...,
        description="Node key sorgente (es. 'fw1:root')"
    )
    target: str = Field(
        ...,
        description="Node key destinazione (next-hop, es. 'fw2:root')"
    )
    subnet: str = Field(
        ...,
        description="Network ID della subnet condivisa (es. '192.168.1.0/24')"
    )
    source_interface: str = Field(
        ...,
        description="Nome interfaccia di uscita dal nodo sorgente (es. 'port1')"
    )
    target_ip: str = Field(
        ...,
        description="IP del next-hop (gateway) su questo link"
    )
    cost: int = Field(
        1,
        description="Metrica/costo del link (da routing table)"
    )
    protocol: str = Field(
        "connected",
        description="Protocollo di routing (connected, static, ospf, bgp)"
    )
    distance: int = Field(
        0,
        description="Administrative Distance del protocollo"
    )
    bandwidth_mbps: Optional[int] = Field(
        None,
        description="Bandwidth dell'interfaccia sorgente in Mbps"
    )
    latency_ms: Optional[float] = Field(
        None,
        description="Latenza stimata del link in millisecondi"
    )
    reliability: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Punteggio di affidabilità del link (0.0 - 1.0)"
    )

    # Backward compatibility: endpoints field for old code
    @property
    def endpoints(self) -> Set[str]:
        """Endpoints per compatibilità con codice esistente."""
        return {self.source, self.target}

    # Backward compatibility: interfaces field
    interfaces: List[InterfaceRecord] = Field(
        default_factory=list,
        description="Interfacce che partecipano a questo link (per compatibilità)"
    )

    @property
    def is_point_to_point(self) -> bool:
        """True se e' un link point-to-point (/30 o /31)."""
        try:
            prefix = int(self.subnet.split("/")[1])
            return prefix >= 30
        except (IndexError, ValueError):
            return False

    @property
    def endpoint_count(self) -> int:
        """Numero di nodi connessi a questo link."""
        return 2  # Always 2 in directed graph

    def __repr__(self) -> str:
        metrics = f"cost={self.cost}"
        if self.bandwidth_mbps:
            metrics += f", bw={self.bandwidth_mbps}Mbps"
        if self.latency_ms:
            metrics += f", lat={self.latency_ms:.2f}ms"
        if self.reliability:
            metrics += f", rel={self.reliability:.2f}"
        return f"Link({self.source} -> {self.target} via {self.subnet}, {metrics})"

    model_config = {
        "str_strip_whitespace": True,
    }


class Topology(BaseModel):
    """
    Grafo completo della rete.

    Contiene:
    - nodes: Set di tutti i nodi (device:vdom)
    - links: Lista di tutti i link (subnet condivise)
    - adjacency: Lista di adiacenza per navigazione efficiente
    - ip_to_owners: Reverse index IP -> (Node, InterfaceRecord)
    """

    nodes: Set[str] = Field(
        default_factory=set,
        description="Set di node_keys (es. {'fw1:root', 'fw2:prod'})"
    )
    links: List[Link] = Field(
        default_factory=list,
        description="Lista di Link (subnet condivise)"
    )
    adjacency: Dict[str, List[Tuple[str, int]]] = Field(
        default_factory=dict,
        description="node_key -> [(neighbor_key, link_index)]"
    )
    ip_to_owners: Dict[int, List[Tuple[str, int]]] = Field(
        default_factory=dict,
        description="IP uint32 -> [(node_key, interface_index in link)]"
    )

    # Store interfaces for reference
    _interfaces: List[InterfaceRecord] = []

    @property
    def node_count(self) -> int:
        """Numero totale di nodi."""
        return len(self.nodes)

    @property
    def link_count(self) -> int:
        """Numero totale di link."""
        return len(self.links)

    def get_neighbors(self, node_key: str) -> List[Tuple[str, Link]]:
        """
        Restituisce i vicini di un nodo.

        Args:
            node_key: Chiave del nodo (es. 'fw1:root')

        Returns:
            Lista di (neighbor_key, Link)
        """
        if node_key not in self.adjacency:
            return []

        return [
            (neighbor_key, self.links[link_idx])
            for neighbor_key, link_idx in self.adjacency[node_key]
        ]

    def find_node_by_ip(self, ip: int) -> Optional[Tuple[str, InterfaceRecord]]:
        """
        Cerca il nodo proprietario di un IP.

        Args:
            ip: Indirizzo IP come uint32

        Returns:
            (node_key, InterfaceRecord) o None se non trovato
        """
        if ip not in self.ip_to_owners:
            return None

        owners = self.ip_to_owners[ip]
        if not owners:
            return None

        # Restituisce il primo owner (potrebbe essere multipli in caso di overlap)
        node_key, iface_idx = owners[0]

        # Trova l'interfaccia nel link
        for link in self.links:
            for iface in link.interfaces:
                if iface.ip == ip and iface.node.node_key == node_key:
                    return (node_key, iface)

        return None

    def get_node(self, node_key: str) -> Optional[Node]:
        """
        Crea un oggetto Node da una node_key.

        Args:
            node_key: Chiave del nodo (es. 'fw1:root')

        Returns:
            Node o None se formato invalido
        """
        if node_key not in self.nodes:
            return None

        parts = node_key.split(":", 1)
        if len(parts) != 2:
            return None

        return Node(device_id=parts[0], vdom=parts[1])

    def __repr__(self) -> str:
        return f"Topology(nodes={self.node_count}, links={self.link_count})"

    model_config = {
        "str_strip_whitespace": True,
        "arbitrary_types_allowed": True,
    }
