"""
FIREWALL VIEW SERVICE - Vista topologica di un singolo firewall

Servizio che estrae la topologia interna di un singolo firewall dallo snapshot:
- Interfacce raggruppate per VDOM
- Link inter-VDOM (rotte con gateway in un altro VDOM dello stesso device)
- Peer esterni (link nella topologia globale che toccano questo device)

Utile per la vista "Micro" nel frontend, dove si visualizza il dettaglio
interno di un FortiGate multi-VDOM.
"""

from __future__ import annotations

import ipaddress
import logging
from typing import Dict, List, Optional, Set, Tuple

from collections import Counter

from pydantic import BaseModel, Field

from application.models.snapshot import NetworkSnapshot
from application.models.topology import InterfaceRecord
from domain.models import Route


logger = logging.getLogger(__name__)


# =============================================================================
# RESPONSE MODELS
# =============================================================================

class InterfaceDetail(BaseModel):
    """Dettaglio di una singola interfaccia."""

    name: str
    ip: str
    prefix_len: int
    network_id: str
    is_up: bool
    interface_type: Optional[str] = None
    bandwidth_mbps: Optional[int] = None


class RouteDetail(BaseModel):
    """Dettaglio di una singola rotta per la routing table view."""

    destination: str
    gateway: str
    interface: str
    protocol: str
    metric: int
    distance: int
    is_default: bool


class VdomDetail(BaseModel):
    """Dettaglio di un VDOM con le sue interfacce e rotte."""

    name: str
    interfaces: List[InterfaceDetail]
    routes_count: int
    routes: List[RouteDetail] = Field(default_factory=list)
    route_protocols: Dict[str, int] = Field(default_factory=dict)


class InternalLink(BaseModel):
    """Link inter-VDOM all'interno dello stesso firewall."""

    source_vdom: str
    target_vdom: str
    source_interface: str
    target_interface: str
    subnet: str
    protocol: str
    cost: int


class ExternalPeer(BaseModel):
    """Connessione verso un altro firewall."""

    vdom: str
    interface: str
    peer_device_id: str
    peer_vdom: str
    subnet: str


class FirewallTopologyResponse(BaseModel):
    """Risposta completa della topologia di un singolo firewall."""

    device_id: str
    vdoms: List[VdomDetail]
    subnets: List[str]
    internal_links: List[InternalLink]
    external_peers: List[ExternalPeer]


# =============================================================================
# SERVICE
# =============================================================================

class FirewallViewService:
    """
    Servizio per estrarre la topologia interna di un singolo firewall.

    Uso:
        service = FirewallViewService()
        result = service.get_firewall_topology(snapshot, "fw-milano")
    """

    def get_firewall_topology(
        self,
        snapshot: NetworkSnapshot,
        device_id: str,
        exclude_default: bool = True,
    ) -> FirewallTopologyResponse:
        """
        Estrae la topologia interna di un singolo firewall dallo snapshot.

        Args:
            snapshot: Snapshot di rete completo
            device_id: ID del firewall da analizzare
            exclude_default: Se True, esclude le default route (0.0.0.0/0)

        Returns:
            FirewallTopologyResponse con VDOM, link interni e peer esterni
        """
        logger.info(
            f"Building firewall topology for {device_id} "
            f"(exclude_default={exclude_default})"
        )

        # 1. Filtra interfacce per device_id
        device_interfaces = [
            iface for iface in snapshot.interfaces
            if iface.device_id == device_id
        ]

        # 2. Raggruppa interfacce per VDOM
        vdom_interfaces: Dict[str, List[InterfaceRecord]] = {}
        for iface in device_interfaces:
            vdom_interfaces.setdefault(iface.vdom, []).append(iface)

        # 3. Filtra routing tables per device_id
        device_routes: Dict[str, List[Route]] = {}
        for node_key, routes in snapshot.routing_tables.items():
            if node_key.startswith(f"{device_id}:"):
                vdom = node_key.split(":", 1)[1]
                device_routes[vdom] = routes

        # 4. Build IP-to-(vdom, iface_name) index per questo device
        ip_to_vdom: Dict[int, Tuple[str, str]] = {}
        for iface in device_interfaces:
            if iface.ip != 0 and iface.is_up:
                ip_to_vdom[iface.ip] = (iface.vdom, iface.iface_name)

        # 5. Costruisci VdomDetail
        vdoms: List[VdomDetail] = []
        all_subnets: Set[str] = set()

        for vdom_name in sorted(vdom_interfaces.keys()):
            ifaces = vdom_interfaces[vdom_name]
            iface_details = []
            for iface in ifaces:
                if iface.ip != 0:
                    detail = InterfaceDetail(
                        name=iface.iface_name,
                        ip=iface.ip_str,
                        prefix_len=iface.prefix_len,
                        network_id=iface.network_id,
                        is_up=iface.is_up,
                        interface_type=iface.interface_type,
                        bandwidth_mbps=iface.bandwidth_mbps,
                    )
                    iface_details.append(detail)
                    all_subnets.add(iface.network_id)

            vdom_routes = device_routes.get(vdom_name, [])
            routes_count = len(vdom_routes)

            # Build route details and protocol summary
            route_details = []
            protocol_counter: Counter = Counter()
            for route in vdom_routes:
                route_details.append(RouteDetail(
                    destination=route.destination,
                    gateway=route.gateway,
                    interface=route.interface,
                    protocol=route.protocol,
                    metric=route.metric,
                    distance=route.distance,
                    is_default=route.is_default_route,
                ))
                protocol_counter[route.protocol] += 1

            vdoms.append(VdomDetail(
                name=vdom_name,
                interfaces=iface_details,
                routes_count=routes_count,
                routes=route_details,
                route_protocols=dict(protocol_counter),
            ))

        # 6. Trova link inter-VDOM
        internal_links = self._find_internal_links(
            device_routes, ip_to_vdom, exclude_default
        )

        # 7. Trova peer esterni
        external_peers = self._find_external_peers(
            snapshot, device_id, vdom_interfaces
        )

        logger.info(
            f"Firewall {device_id}: {len(vdoms)} VDOMs, "
            f"{len(internal_links)} internal links, "
            f"{len(external_peers)} external peers"
        )

        return FirewallTopologyResponse(
            device_id=device_id,
            vdoms=vdoms,
            subnets=sorted(all_subnets),
            internal_links=internal_links,
            external_peers=external_peers,
        )

    def _find_internal_links(
        self,
        device_routes: Dict[str, List[Route]],
        ip_to_vdom: Dict[int, Tuple[str, str]],
        exclude_default: bool,
    ) -> List[InternalLink]:
        """
        Trova link inter-VDOM: rotte in VDOM A con gateway che appartiene a VDOM B.

        Args:
            device_routes: Dict[vdom_name, List[Route]]
            ip_to_vdom: Dict[ip_uint32, (vdom_name, iface_name)]
            exclude_default: Se True, skip rotte con destination 0.0.0.0/0

        Returns:
            Lista di InternalLink
        """
        links: List[InternalLink] = []
        seen: Set[Tuple[str, str, str]] = set()  # (src_vdom, tgt_vdom, subnet)

        for src_vdom, routes in device_routes.items():
            for route in routes:
                # Skip default route se richiesto
                if exclude_default and route.is_default_route:
                    continue

                # Skip rotte senza gateway reale
                if route.gateway == "0.0.0.0" or not route.gateway:
                    continue

                # Cerca il gateway tra le interfacce dello stesso device
                try:
                    gw_ip_int = int(ipaddress.IPv4Address(route.gateway))
                except (ValueError, ipaddress.AddressValueError):
                    continue

                if gw_ip_int not in ip_to_vdom:
                    continue

                tgt_vdom, tgt_iface = ip_to_vdom[gw_ip_int]

                # Link inter-VDOM: deve essere un VDOM diverso
                if tgt_vdom == src_vdom:
                    continue

                # Deduplica
                signature = (src_vdom, tgt_vdom, route.destination)
                if signature in seen:
                    continue
                seen.add(signature)

                links.append(InternalLink(
                    source_vdom=src_vdom,
                    target_vdom=tgt_vdom,
                    source_interface=route.interface,
                    target_interface=tgt_iface,
                    subnet=route.destination,
                    protocol=route.protocol,
                    cost=route.metric,
                ))

        return links

    def _find_external_peers(
        self,
        snapshot: NetworkSnapshot,
        device_id: str,
        vdom_interfaces: Dict[str, List[InterfaceRecord]],
    ) -> List[ExternalPeer]:
        """
        Trova connessioni verso altri firewall dalla topologia globale.

        Args:
            snapshot: Snapshot completo
            device_id: ID del firewall corrente
            vdom_interfaces: Interfacce raggruppate per VDOM

        Returns:
            Lista di ExternalPeer
        """
        peers: List[ExternalPeer] = []
        seen: Set[Tuple[str, str, str]] = set()  # (vdom, peer_device, subnet)

        for link in snapshot.topology.links:
            source_key = link.source or ""
            target_key = link.target or ""

            # Caso 1: questo device e' la sorgente del link
            if source_key.startswith(f"{device_id}:"):
                src_vdom = source_key.split(":", 1)[1]
                if target_key and ":" in target_key:
                    peer_parts = target_key.split(":", 1)
                    peer_device = peer_parts[0]
                    peer_vdom = peer_parts[1]

                    if peer_device == device_id:
                        continue  # Link interno, gestito da internal_links

                    signature = (src_vdom, peer_device, link.subnet)
                    if signature in seen:
                        continue
                    seen.add(signature)

                    peers.append(ExternalPeer(
                        vdom=src_vdom,
                        interface=link.source_interface or "",
                        peer_device_id=peer_device,
                        peer_vdom=peer_vdom,
                        subnet=link.subnet,
                    ))

            # Caso 2: questo device e' il target del link
            elif target_key.startswith(f"{device_id}:"):
                tgt_vdom = target_key.split(":", 1)[1]
                if source_key and ":" in source_key:
                    peer_parts = source_key.split(":", 1)
                    peer_device = peer_parts[0]
                    peer_vdom = peer_parts[1]

                    if peer_device == device_id:
                        continue

                    signature = (tgt_vdom, peer_device, link.subnet)
                    if signature in seen:
                        continue
                    seen.add(signature)

                    # Trova l'interfaccia locale dal link
                    local_iface = ""
                    for iface in link.interfaces:
                        if iface.device_id == device_id and iface.vdom == tgt_vdom:
                            local_iface = iface.iface_name
                            break

                    peers.append(ExternalPeer(
                        vdom=tgt_vdom,
                        interface=local_iface,
                        peer_device_id=peer_device,
                        peer_vdom=peer_vdom,
                        subnet=link.subnet,
                    ))

        return peers
