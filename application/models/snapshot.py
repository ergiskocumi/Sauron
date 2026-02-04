"""
NETWORK SNAPSHOT - Persistenza dello stato di rete

Modello per la serializzazione e deserializzazione dello stato
completo della rete (topologia + routing tables).

Permette di:
- Eseguire scan una volta e salvare su disco
- Eseguire query multiple istantanee offline
- Confrontare snapshot temporali
- Debug senza dipendere dalla rete live
"""

from __future__ import annotations
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from application.models.topology import Topology, InterfaceRecord
from domain.models import Route


class FirewallMetadata(BaseModel):
    """Metadati di un singolo firewall nello snapshot."""

    device_id: str = Field(
        ...,
        description="ID univoco del firewall"
    )
    host: str = Field(
        ...,
        description="Host:porta del firewall"
    )
    vdoms: List[str] = Field(
        default_factory=list,
        description="Lista dei VDOM scansionati"
    )
    routes_count: int = Field(
        0,
        description="Numero totale di rotte"
    )
    interfaces_count: int = Field(
        0,
        description="Numero totale di interfacce"
    )
    scan_success: bool = Field(
        True,
        description="Se la scansione e' riuscita"
    )
    error_message: Optional[str] = Field(
        None,
        description="Eventuale messaggio di errore"
    )

    model_config = {
        "str_strip_whitespace": True,
    }


class NetworkSnapshot(BaseModel):
    """
    Snapshot completo dello stato di rete.

    Contiene tutti i dati necessari per eseguire query offline:
    - Topologia (grafo nodi/link)
    - Routing tables per ogni node_key
    - Interfacce raw per reference
    - Metadati sulla scansione

    Uso:
        # Creazione
        snapshot = NetworkSnapshot(
            topology=topology,
            routing_tables=routes,
            interfaces=interfaces,
            firewalls_metadata=[...],
        )

        # Salvataggio
        repository.save(snapshot, "network.snapshot")

        # Caricamento
        snapshot = repository.load("network.snapshot")
    """

    # Core data
    topology: Topology = Field(
        ...,
        description="Grafo di rete (nodi, link, indici)"
    )
    routing_tables: Dict[str, List[Route]] = Field(
        default_factory=dict,
        description="Routing tables per node_key (es. 'fw1:root')"
    )
    interfaces: List[InterfaceRecord] = Field(
        default_factory=list,
        description="Lista completa delle interfacce"
    )

    # Metadata
    timestamp: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp della creazione dello snapshot"
    )
    version: str = Field(
        "1.0",
        description="Versione del formato snapshot"
    )
    firewalls_metadata: List[FirewallMetadata] = Field(
        default_factory=list,
        description="Metadati per ogni firewall scansionato"
    )

    # Statistics
    @property
    def total_nodes(self) -> int:
        """Numero totale di nodi nella topologia."""
        return self.topology.node_count

    @property
    def total_links(self) -> int:
        """Numero totale di link nella topologia."""
        return self.topology.link_count

    @property
    def total_routes(self) -> int:
        """Numero totale di rotte."""
        return sum(len(routes) for routes in self.routing_tables.values())

    @property
    def total_interfaces(self) -> int:
        """Numero totale di interfacce."""
        return len(self.interfaces)

    @property
    def firewalls_count(self) -> int:
        """Numero di firewall nello snapshot."""
        return len(self.firewalls_metadata)

    @property
    def successful_scans(self) -> int:
        """Numero di scansioni riuscite."""
        return sum(1 for fw in self.firewalls_metadata if fw.scan_success)

    @property
    def age_seconds(self) -> float:
        """Eta' dello snapshot in secondi."""
        return (datetime.now() - self.timestamp).total_seconds()

    @property
    def age_human(self) -> str:
        """Eta' dello snapshot in formato leggibile."""
        seconds = self.age_seconds
        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            return f"{int(seconds / 60)}m"
        elif seconds < 86400:
            return f"{int(seconds / 3600)}h"
        else:
            return f"{int(seconds / 86400)}d"

    def get_node_routes(self, node_key: str) -> List[Route]:
        """
        Restituisce le rotte per un nodo specifico.

        Args:
            node_key: Chiave del nodo (es. 'fw1:root')

        Returns:
            Lista di Route o lista vuota se nodo non trovato
        """
        return self.routing_tables.get(node_key, [])

    def get_firewall_metadata(self, device_id: str) -> Optional[FirewallMetadata]:
        """
        Restituisce i metadati di un firewall.

        Args:
            device_id: ID del firewall

        Returns:
            FirewallMetadata o None se non trovato
        """
        for fw in self.firewalls_metadata:
            if fw.device_id == device_id:
                return fw
        return None

    def summary(self) -> str:
        """Restituisce un summary testuale dello snapshot."""
        lines = [
            f"NetworkSnapshot v{self.version}",
            f"  Created: {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')} ({self.age_human} ago)",
            f"  Firewalls: {self.firewalls_count} ({self.successful_scans} successful)",
            f"  Nodes: {self.total_nodes}",
            f"  Links: {self.total_links}",
            f"  Routes: {self.total_routes}",
            f"  Interfaces: {self.total_interfaces}",
        ]
        return "\n".join(lines)

    def __repr__(self) -> str:
        return (
            f"NetworkSnapshot("
            f"nodes={self.total_nodes}, "
            f"links={self.total_links}, "
            f"routes={self.total_routes}, "
            f"age={self.age_human})"
        )

    model_config = {
        "str_strip_whitespace": True,
        "arbitrary_types_allowed": True,
    }
