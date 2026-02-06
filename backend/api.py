"""
SAURON REST API - FastAPI Backend

Espone le funzionalità del progetto Sauron tramite API REST.
Riusa completamente i servizi esistenti senza riscrivere la logica.

Endpoints:
- GET  /api/inventory         - Lista firewall (token oscurato)
- POST /api/inventory         - Aggiunge un nuovo firewall all'inventario
- GET  /api/snapshot/status   - Stato snapshot corrente
- POST /api/scan              - Avvia scansione asincrona
- GET  /api/topology          - Topologia completa da snapshot
- POST /api/path              - Calcola percorso tra sorgente e destinazione
- GET  /api/firewall/{id}/detail - Dettaglio completo di un firewall (live + snapshot)

Run:
    uvicorn backend.api:app --reload

Test interattivo:
    http://127.0.0.1:8080/docs
"""

from __future__ import annotations

import asyncio
import time
import ipaddress
import logging
import re
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# Domain & Core
from domain.models import FirewallConfig, SystemResource, SystemStatus, FirewallPolicy, AddressObject
from core.inventory import InventoryLoader, InventoryError
from core.config import get_settings

# Infrastructure
from infrastructure.snapshot_repository import (
    SnapshotRepository,
    SnapshotNotFoundError,
    SnapshotCorruptedError,
)
# Application Services
from application.services.scan_service import ScanService
from application.services.topology_service import TopologyService
from application.services.pathfinder_service import PathfinderService
from application.services.firewall_view_service import (
    FirewallViewService,
    FirewallTopologyResponse,
)
from application.services.dijkstra_service import (
    DijkstraService,
    PROFILE_BALANCED,
    PROFILE_BULK,
    PROFILE_REALTIME,
    PROFILE_CRITICAL,
    PROFILE_COST_ONLY,
)
from application.services.resolver_service import (
    ResolverService,
    InvalidSourceError,
    NodeNotFoundError,
    AmbiguousSourceError,
    InvalidTargetError,
)
from application.models.snapshot import NetworkSnapshot
from application.models.pathfinder import PathResult
from infrastructure.fortigate_client import FortiGateClient


# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# =============================================================================
# FASTAPI APP INITIALIZATION
# =============================================================================

app = FastAPI(
    title="Sauron Network Discovery API",
    description="REST API for Sauron - Multi-Firewall Network Topology Discovery",
    version="0.1.0",
)

# CORS Configuration
_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# =============================================================================
# PYDANTIC MODELS (Request/Response)
# =============================================================================

class FirewallConfigPublic(BaseModel):
    """Firewall config senza token (per sicurezza)."""

    id: str
    host: str
    entry_vdom: str
    enabled: bool
    vdoms: List[str] = Field(default_factory=list, description="Lista VDOM rilevati dallo snapshot")
    status_scan: Optional[bool] = Field(None, description="Esito ultimo scan")

    @classmethod
    def from_config(cls, config: FirewallConfig, vdoms: List[str] = None, status_scan: bool = None) -> "FirewallConfigPublic":
        """Converte FirewallConfig in versione pubblica con dati opzionali dallo snapshot."""
        return cls(
            id=config.id,
            host=config.host,
            entry_vdom=config.entry_vdom,
            enabled=config.enabled,
            vdoms=vdoms or [],
            status_scan=status_scan
        )


class FirewallHealth(BaseModel):
    """Stato di raggiungibilità live del firewall."""

    id: str
    reachable: bool
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    checked_at: datetime


class AddFirewallRequest(BaseModel):
    """Request body per POST /api/inventory."""

    id: str = Field(
        ...,
        description="Nome identificativo del firewall",
        examples=["Firewall Milano"],
        min_length=1,
    )
    host: str = Field(
        ...,
        description="IP:Porta del firewall (es. '10.0.0.1:10443')",
        examples=["10.101.201.1:10443"],
    )
    token: str = Field(
        ...,
        description="API Token FortiGate per autenticazione",
        min_length=1,
    )


class AddFirewallResponse(BaseModel):
    """Risposta per POST /api/inventory."""

    status: str
    message: str
    firewall: FirewallConfigPublic


class SnapshotStatusResponse(BaseModel):
    """Stato dello snapshot corrente."""

    exists: bool
    path: Optional[str] = None
    timestamp: Optional[datetime] = None
    age_human: Optional[str] = None
    nodes_count: Optional[int] = None
    links_count: Optional[int] = None
    routes_count: Optional[int] = None
    interfaces_count: Optional[int] = None
    firewalls_count: Optional[int] = None


class ScanResponse(BaseModel):
    """Risposta immediata per POST /api/scan."""

    status: str = Field(..., description="Stato operazione")
    message: str = Field(..., description="Messaggio descrittivo")


class PathRequest(BaseModel):
    """Request body per POST /api/path."""

    source: str = Field(
        ...,
        description="Nodo sorgente (es. 'fw-milano' o 'fw-milano:root')",
        examples=["fw-milano", "fw-milano:root"],
    )
    destination: str = Field(
        ...,
        description="IP destinazione (dotted-decimal)",
        examples=["10.0.0.1", "192.168.1.100"],
    )

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        """Valida formato source: device-id o device-id:vdom."""
        if not re.match(r'^[\w\-]+(:\w+)?$', v):
            raise ValueError(
                "Source deve essere 'device-id' o 'device-id:vdom' "
                "(solo lettere, numeri, trattini e underscore)"
            )
        return v

    @field_validator("destination")
    @classmethod
    def validate_destination(cls, v: str) -> str:
        """Valida che destination sia un indirizzo IP valido o un node_key."""
        # Accetta sia IP puri che node_key (device:vdom)
        try:
            ipaddress.ip_address(v)
            return v
        except ValueError:
            pass
        # Accetta anche node_key per path tra nodi
        if re.match(r'^[\w\-]+(:\w+)?$', v):
            return v
        raise ValueError(
            "Destination deve essere un IP valido (es. '10.0.0.1') "
            "o un node_key (es. 'fw-roma:root')"
        )

    max_ttl: int = Field(
        64,
        description="Massimo numero di hop (default 64)",
        ge=1,
        le=255,
    )
    algorithm: str = Field(
        "lpm",
        description="Algoritmo di pathfinding: 'lpm' (routing simulation) o 'dijkstra' (shortest path)",
        examples=["lpm", "dijkstra"],
    )
    profile: Optional[str] = Field(
        None,
        description="Profilo Dijkstra: 'balanced', 'bulk', 'realtime', 'critical', 'cost_only'",
        examples=["balanced", "bulk", "realtime"],
    )
    exclude_default_route: bool = Field(
        False,
        description="Se True, esclude la default route (0.0.0.0/0) dal pathfinding",
    )


class TopologyResponse(BaseModel):
    """Topologia completa serializzata."""

    nodes: List[str] = Field(
        ...,
        description="Lista di node_keys (es. 'fw-milano:root')"
    )
    links: List[Dict[str, Any]] = Field(
        ...,
        description="Lista di link (subnet condivise)"
    )
    node_count: int
    link_count: int


# =============================================================================
# GLOBAL STATE (Snapshot Repository)
# =============================================================================

# Path di default per lo snapshot
DEFAULT_SNAPSHOT_PATH = Path("network.snapshot.gz")

# Repository singleton
snapshot_repository = SnapshotRepository(compress=True)

# Scan lock to prevent concurrent scans
_scan_lock = asyncio.Lock()


def _split_host_port(host: str) -> tuple[str, int]:
    """Estrae host e porta da stringa IP:PORT."""
    if not host:
        return "", 443

    if ":" in host:
        base, port = host.rsplit(":", 1)
        try:
            return base, int(port)
        except ValueError:
            return host, 443

    return host, 443


async def _check_firewall_reachability(cfg: FirewallConfig, timeout: float = 1.5) -> FirewallHealth:
    """Verifica raggiungibilità TCP del firewall (host:port)."""
    checked_at = datetime.utcnow()

    if not cfg.enabled:
        return FirewallHealth(
            id=cfg.id,
            reachable=False,
            latency_ms=None,
            error="Disabled",
            checked_at=checked_at,
        )

    host, port = _split_host_port(cfg.host)
    if not host:
        return FirewallHealth(
            id=cfg.id,
            reachable=False,
            latency_ms=None,
            error="Host missing",
            checked_at=checked_at,
        )

    start = time.perf_counter()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.close()
        await writer.wait_closed()
        latency_ms = (time.perf_counter() - start) * 1000.0
        return FirewallHealth(
            id=cfg.id,
            reachable=True,
            latency_ms=round(latency_ms, 2),
            error=None,
            checked_at=checked_at,
        )
    except Exception as e:
        return FirewallHealth(
            id=cfg.id,
            reachable=False,
            latency_ms=None,
            error=str(e),
            checked_at=checked_at,
        )


# =============================================================================
# API ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """Health check."""
    return {
        "service": "Sauron Network Discovery API",
        "status": "running",
        "version": "0.1.0",
    }


@app.get("/api/inventory", response_model=List[FirewallConfigPublic])
async def get_inventory():
    """
    Restituisce la lista dei firewall dall'inventory.json arricchita con i dati dello snapshot.
    """
    try:
        loader = InventoryLoader("inventory.json")
        configs = loader.load()

        # Prova a caricare lo snapshot per arricchire i dati
        vdom_map = {}
        status_map = {}
        if snapshot_repository.exists(DEFAULT_SNAPSHOT_PATH):
            try:
                snap = snapshot_repository.load(DEFAULT_SNAPSHOT_PATH)
                for fw in snap.firewalls_metadata:
                    vdom_map[fw.device_id] = fw.vdoms
                    status_map[fw.device_id] = fw.scan_success
            except Exception as e:
                logger.warning(f"Could not enrich inventory from snapshot: {e}")

        # Converti in versione pubblica arricchita
        return [
            FirewallConfigPublic.from_config(
                cfg, 
                vdoms=vdom_map.get(cfg.id),
                status_scan=status_map.get(cfg.id)
            ) 
            for cfg in configs
        ]

    except InventoryError as e:
        logger.error(f"Inventory error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error loading inventory: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.get("/api/inventory/health", response_model=List[FirewallHealth])
async def get_inventory_health():
    """
    Verifica raggiungibilità live dei firewall (TCP connect su host:port).
    """
    try:
        loader = InventoryLoader("inventory.json")
        configs = loader.load()

        checks = [
            _check_firewall_reachability(cfg)
            for cfg in configs
        ]
        return await asyncio.gather(*checks)
    except InventoryError as e:
        logger.error(f"Inventory error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error health check: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.post("/api/inventory", response_model=AddFirewallResponse)
async def add_firewall(request: AddFirewallRequest):
    """
    Aggiunge un nuovo firewall all'inventario.

    Controlli:
    - Nome duplicato (case-insensitive)
    - IP duplicato (ignora porta)
    - Token viene salvato ma non controllato per unicità

    Returns:
        Firewall aggiunto (senza token)

    Raises:
        400: Se dati non validi o duplicati
        500: Se errore di scrittura
    """
    try:
        loader = InventoryLoader("inventory.json")
        entry = loader.add_firewall({
            "id": request.id,
            "host": request.host,
            "token": request.token,
        })

        return AddFirewallResponse(
            status="created",
            message=f"Firewall '{request.id}' aggiunto con successo.",
            firewall=FirewallConfigPublic(
                id=entry["id"],
                host=entry["host"],
                entry_vdom="root",
                enabled=True,
            ),
        )

    except InventoryError as e:
        logger.warning(f"Add firewall rejected: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error adding firewall: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Errore interno: {e}")


@app.get("/api/snapshot/status", response_model=SnapshotStatusResponse)
async def get_snapshot_status():
    """
    Verifica se esiste uno snapshot caricato e restituisce metadati.

    Returns:
        Metadati dello snapshot (data, numero nodi, link, ecc.)
    """
    if not snapshot_repository.exists(DEFAULT_SNAPSHOT_PATH):
        return SnapshotStatusResponse(exists=False)

    try:
        # Carica snapshot per leggere metadati
        snapshot = snapshot_repository.load(DEFAULT_SNAPSHOT_PATH)

        return SnapshotStatusResponse(
            exists=True,
            path=str(DEFAULT_SNAPSHOT_PATH),
            timestamp=snapshot.timestamp,
            age_human=snapshot.age_human,
            nodes_count=snapshot.total_nodes,
            links_count=snapshot.total_links,
            routes_count=snapshot.total_routes,
            interfaces_count=snapshot.total_interfaces,
            firewalls_count=snapshot.firewalls_count,
        )

    except (SnapshotNotFoundError, SnapshotCorruptedError) as e:
        logger.error(f"Snapshot error: {e}")
        return SnapshotStatusResponse(exists=False)
    except Exception as e:
        logger.error(f"Unexpected error loading snapshot: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.post("/api/scan", response_model=ScanResponse)
async def scan_network(background_tasks: BackgroundTasks):
    """
    Avvia una scansione asincrona della rete.

    La scansione viene eseguita in background per non bloccare la richiesta.
    Al termine, lo snapshot viene salvato su disco.

    IMPORTANTE: Questa operazione può richiedere diversi secondi/minuti
    a seconda del numero di firewall da scansionare.

    Returns:
        Messaggio di conferma (scan started)
    """
    if _scan_lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Scan already in progress",
        )

    background_tasks.add_task(_perform_scan)

    return ScanResponse(
        status="started",
        message="Network scan started. Check /api/snapshot/status for completion.",
    )


async def _perform_scan():
    """Funzione background che delega la scansione a ScanService."""
    async with _scan_lock:
        try:
            scan_service = ScanService(
                inventory_path="inventory.json",
                snapshot_path=DEFAULT_SNAPSHOT_PATH,
                snapshot_repository=snapshot_repository,
            )
            await scan_service.execute()
        except Exception as e:
            logger.error(f"Scan failed: {e}", exc_info=True)


@app.get("/api/topology", response_model=TopologyResponse)
async def get_topology():
    """
    Restituisce la topologia completa (nodi e link) da snapshot.

    Returns:
        Topologia in formato JSON (per rendering frontend)

    Raises:
        404: Se snapshot non esiste
        500: Se snapshot corrotto
    """
    if not snapshot_repository.exists(DEFAULT_SNAPSHOT_PATH):
        raise HTTPException(
            status_code=404,
            detail="No snapshot found. Run /api/scan first.",
        )

    try:
        snapshot = snapshot_repository.load(DEFAULT_SNAPSHOT_PATH)
        topology = snapshot.topology

        # Serializza link con next-hop relationships e metriche avanzate
        links_serialized = []
        for link in topology.links:
            links_serialized.append({
                "source": link.source,
                "target": link.target,
                "subnet": link.subnet,
                "source_interface": link.source_interface,
                "target_ip": link.target_ip,
                "cost": link.cost,
                "protocol": link.protocol,
                "distance": link.distance,
                "bandwidth_mbps": link.bandwidth_mbps,
                "latency_ms": link.latency_ms,
                "reliability": link.reliability,
                "is_point_to_point": link.is_point_to_point,
                "endpoints": list(link.endpoints),
                "endpoint_count": link.endpoint_count,
                "interfaces": [
                    {
                        "device_id": iface.device_id,
                        "vdom": iface.vdom,
                        "iface_name": iface.iface_name,
                        "ip": iface.ip_str,
                        "prefix_len": iface.prefix_len,
                        "network_id": iface.network_id,
                        "is_up": iface.is_up,
                        "bandwidth_mbps": iface.bandwidth_mbps,
                        "interface_type": iface.interface_type,
                    }
                    for iface in link.interfaces
                ],
            })

        return TopologyResponse(
            nodes=list(topology.nodes),
            links=links_serialized,
            node_count=topology.node_count,
            link_count=topology.link_count,
        )

    except (SnapshotNotFoundError, SnapshotCorruptedError) as e:
        logger.error(f"Snapshot error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.post("/api/path", response_model=PathResult)
async def calculate_path(request: PathRequest):
    """
    Calcola il percorso tra nodo sorgente e IP destinazione.

    Usa:
    - ResolverService per convertire input utente in Node valido
    - PathfinderService per simulare il percorso pacchetti

    Returns:
        PathResult con hops, status e dettagli del percorso

    Raises:
        400: Se input non valido (nodo non trovato, IP invalido)
        404: Se snapshot non esiste
    """
    if not snapshot_repository.exists(DEFAULT_SNAPSHOT_PATH):
        raise HTTPException(
            status_code=404,
            detail="No snapshot found. Run /api/scan first.",
        )

    try:
        # Carica snapshot
        snapshot = snapshot_repository.load(DEFAULT_SNAPSHOT_PATH)

        # Risolvi input utente
        resolver = ResolverService(default_vdom="root")

        try:
            source_node = resolver.resolve_source(request.source, snapshot)
        except (InvalidSourceError, NodeNotFoundError, AmbiguousSourceError) as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid source: {e.message}",
            )

        try:
            target_ip = resolver.resolve_target_ip(request.destination, snapshot)
        except InvalidTargetError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid destination: {e.message}",
            )

        # Calcola percorso con algoritmo selezionato
        if request.algorithm.lower() == "dijkstra":
            # Dijkstra shortest path
            logger.info(f"Using Dijkstra algorithm with profile: {request.profile or 'balanced'}")

            # Risolvi profilo
            profile_map = {
                "balanced": PROFILE_BALANCED,
                "bulk": PROFILE_BULK,
                "realtime": PROFILE_REALTIME,
                "critical": PROFILE_CRITICAL,
                "cost_only": PROFILE_COST_ONLY,
            }
            profile = profile_map.get(request.profile or "balanced", PROFILE_BALANCED)

            dijkstra = DijkstraService()
            result = dijkstra.shortest_path(
                topology=snapshot.topology,
                start_node=source_node,
                target_ip=target_ip,
                profile=profile,
            )
        else:
            # LPM simulation (default)
            logger.info("Using LPM routing simulation")
            pathfinder = PathfinderService()
            result = pathfinder.find_path(
                topology=snapshot.topology,
                routing_tables=snapshot.routing_tables,
                start_node=source_node,
                target_ip=target_ip,
                max_ttl=request.max_ttl,
                exclude_default_route=request.exclude_default_route,
            )

        return result

    except HTTPException:
        raise
    except (SnapshotNotFoundError, SnapshotCorruptedError) as e:
        logger.error(f"Snapshot error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@app.get("/api/topology/firewall/{device_id}", response_model=FirewallTopologyResponse)
async def get_firewall_topology(device_id: str, exclude_default: bool = True):
    """
    Restituisce la topologia interna di un singolo firewall.

    Mostra i VDOM, le interfacce, i link inter-VDOM e i peer esterni.
    Utile per la vista "Micro" (single firewall drill-down).

    Args:
        device_id: ID del firewall (es. 'fw-milano')
        exclude_default: Se True (default), esclude le default route 0.0.0.0/0

    Returns:
        FirewallTopologyResponse

    Raises:
        404: Se snapshot non esiste o device_id non trovato
    """
    if not snapshot_repository.exists(DEFAULT_SNAPSHOT_PATH):
        raise HTTPException(
            status_code=404,
            detail="No snapshot found. Run /api/scan first.",
        )

    try:
        snapshot = snapshot_repository.load(DEFAULT_SNAPSHOT_PATH)

        # Verifica che il device_id esista nello snapshot
        fw_metadata = snapshot.get_firewall_metadata(device_id)
        if fw_metadata is None:
            raise HTTPException(
                status_code=404,
                detail=f"Firewall '{device_id}' not found in snapshot.",
            )

        service = FirewallViewService()
        return service.get_firewall_topology(
            snapshot=snapshot,
            device_id=device_id,
            exclude_default=exclude_default,
        )

    except HTTPException:
        raise
    except (SnapshotNotFoundError, SnapshotCorruptedError) as e:
        logger.error(f"Snapshot error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


# =============================================================================
# FIREWALL DETAIL ENDPOINT
# =============================================================================

class SystemStatusPublic(BaseModel):
    """Stato del sistema per il frontend."""
    hostname: str = ""
    serial: str = ""
    model_name: str = ""
    firmware_version: str = ""
    uptime: int = 0
    uptime_human: str = ""


class SystemResourcePublic(BaseModel):
    """Risorse di sistema per il frontend."""
    cpu_usage: int = 0
    memory_usage: int = 0
    memory_total: int = 0
    memory_used: int = 0
    session_count: int = 0
    setup_rate: int = 0


class PolicyPublic(BaseModel):
    """Policy pubblica per il frontend."""
    policy_id: int
    name: str = ""
    src_interfaces: List[str] = Field(default_factory=list)
    dst_interfaces: List[str] = Field(default_factory=list)
    src_addresses: List[str] = Field(default_factory=list)
    dst_addresses: List[str] = Field(default_factory=list)
    services: List[str] = Field(default_factory=list)
    action: str = "deny"
    status: str = "enable"
    log_traffic: str = "disable"
    bytes: int = 0
    hit_count: int = 0
    comments: str = ""


class AddressObjectPublic(BaseModel):
    """Oggetto indirizzo per il frontend."""
    name: str
    type: str = "ipmask"
    subnet: Optional[str] = None
    fqdn: Optional[str] = None
    start_ip: Optional[str] = None
    end_ip: Optional[str] = None
    associated_interface: Optional[str] = None
    comment: Optional[str] = None


class VdomDetailFull(BaseModel):
    """VDOM con tutti i dettagli incluse policies e objects."""
    name: str
    interfaces: List[Dict[str, Any]] = Field(default_factory=list)
    routes_count: int = 0
    routes: List[Dict[str, Any]] = Field(default_factory=list)
    route_protocols: Dict[str, int] = Field(default_factory=dict)
    policies: List[PolicyPublic] = Field(default_factory=list)
    address_objects: List[AddressObjectPublic] = Field(default_factory=list)


class FirewallDetailResponse(BaseModel):
    """Risposta completa del dettaglio di un singolo firewall."""
    device_id: str
    system_status: SystemStatusPublic
    system_resources: SystemResourcePublic
    vdoms: List[VdomDetailFull]
    internal_links: List[Dict[str, Any]] = Field(default_factory=list)
    external_peers: List[Dict[str, Any]] = Field(default_factory=list)
    subnets: List[str] = Field(default_factory=list)


@app.get("/api/firewall/{device_id}/detail", response_model=FirewallDetailResponse)
async def get_firewall_detail(device_id: str):
    """
    Restituisce il dettaglio completo di un singolo firewall.

    Combina:
    - Dati live dal firewall (CPU, RAM, sessioni, status, policies, objects)
    - Dati dallo snapshot (interfacce, rotte, topologia)

    Args:
        device_id: ID del firewall (es. 'Firewall Wetechs Calenzano')

    Returns:
        FirewallDetailResponse

    Raises:
        404: Se firewall non trovato nell'inventario
        503: Se il firewall non è raggiungibile
    """
    # 1. Carica inventario per ottenere host e token
    try:
        loader = InventoryLoader("inventory.json")
        configs = loader.load()
    except InventoryError as e:
        raise HTTPException(status_code=404, detail=str(e))

    fw_config = None
    for cfg in configs:
        if cfg.id == device_id:
            fw_config = cfg
            break

    if fw_config is None:
        raise HTTPException(
            status_code=404,
            detail=f"Firewall '{device_id}' non trovato nell'inventario.",
        )

    # 2. Carica dati snapshot (interfacce, routes, topology)
    snapshot_data = None
    if snapshot_repository.exists(DEFAULT_SNAPSHOT_PATH):
        try:
            snapshot = snapshot_repository.load(DEFAULT_SNAPSHOT_PATH)
            fw_service = FirewallViewService()
            snapshot_data = fw_service.get_firewall_topology(
                snapshot=snapshot,
                device_id=device_id,
                exclude_default=False,
            )
        except Exception as e:
            logger.warning(f"Could not load snapshot data for {device_id}: {e}")

    # 3. Fetch dati live dal firewall
    system_status = SystemStatusPublic()
    system_resources = SystemResourcePublic()
    vdom_policies: Dict[str, List[FirewallPolicy]] = {}
    vdom_objects: Dict[str, List[AddressObject]] = {}

    try:
        async with FortiGateClient(fw_config.host, fw_config.token) as client:
            # Fetch system info in parallelo
            status_task = client.get_system_status()
            resources_task = client.get_system_resources()

            status_result, resources_result = await asyncio.gather(
                status_task, resources_task,
                return_exceptions=True,
            )

            if isinstance(status_result, SystemStatus):
                system_status = SystemStatusPublic(
                    hostname=status_result.hostname,
                    serial=status_result.serial,
                    model_name=status_result.model_name,
                    firmware_version=status_result.firmware_version,
                    uptime=status_result.uptime,
                    uptime_human=status_result.uptime_human,
                )
            else:
                logger.warning(f"Failed to get system status: {status_result}")

            if isinstance(resources_result, SystemResource):
                system_resources = SystemResourcePublic(
                    cpu_usage=resources_result.cpu_usage,
                    memory_usage=resources_result.memory_usage,
                    memory_total=resources_result.memory_total,
                    memory_used=resources_result.memory_used,
                    session_count=resources_result.session_count,
                    setup_rate=resources_result.setup_rate,
                )
            else:
                logger.warning(f"Failed to get system resources: {resources_result}")

            # Determina lista VDOM
            vdom_names = []
            if snapshot_data:
                vdom_names = [v.name for v in snapshot_data.vdoms]
            else:
                try:
                    vdoms_list = await client.get_vdoms()
                    vdom_names = [v.name for v in vdoms_list]
                except Exception as e:
                    logger.warning(f"Failed to get VDOMs: {e}")
                    vdom_names = ["root"]

            # Fetch policies e objects per ogni VDOM in parallelo
            policy_tasks = {
                vdom: client.get_firewall_policies(vdom=vdom)
                for vdom in vdom_names
            }
            object_tasks = {
                vdom: client.get_address_objects(vdom=vdom)
                for vdom in vdom_names
            }

            all_tasks = list(policy_tasks.values()) + list(object_tasks.values())
            results = await asyncio.gather(*all_tasks, return_exceptions=True)

            # Split results
            n_vdoms = len(vdom_names)
            policy_results = results[:n_vdoms]
            object_results = results[n_vdoms:]

            for i, vdom in enumerate(vdom_names):
                if isinstance(policy_results[i], list):
                    vdom_policies[vdom] = policy_results[i]
                else:
                    logger.warning(f"Failed to get policies for VDOM {vdom}: {policy_results[i]}")
                    vdom_policies[vdom] = []

                if isinstance(object_results[i], list):
                    vdom_objects[vdom] = object_results[i]
                else:
                    logger.warning(f"Failed to get objects for VDOM {vdom}: {object_results[i]}")
                    vdom_objects[vdom] = []

    except Exception as e:
        logger.warning(f"Could not connect to firewall {device_id} for live data: {e}")

    # 4. Componi risposta finale
    vdoms_full: List[VdomDetailFull] = []

    if snapshot_data:
        for vdom in snapshot_data.vdoms:
            policies = vdom_policies.get(vdom.name, [])
            objects = vdom_objects.get(vdom.name, [])

            vdoms_full.append(VdomDetailFull(
                name=vdom.name,
                interfaces=[iface.model_dump() for iface in vdom.interfaces],
                routes_count=vdom.routes_count,
                routes=[route.model_dump() for route in vdom.routes],
                route_protocols=vdom.route_protocols,
                policies=[
                    PolicyPublic(
                        policy_id=p.policy_id,
                        name=p.name,
                        src_interfaces=p.src_interfaces,
                        dst_interfaces=p.dst_interfaces,
                        src_addresses=p.src_addresses,
                        dst_addresses=p.dst_addresses,
                        services=p.services,
                        action=p.action,
                        status=p.status,
                        log_traffic=p.log_traffic,
                        bytes=p.bytes,
                        hit_count=p.hit_count,
                        comments=p.comments,
                    )
                    for p in policies
                ],
                address_objects=[
                    AddressObjectPublic(
                        name=obj.name,
                        type=obj.type,
                        subnet=obj.subnet,
                        fqdn=obj.fqdn,
                        start_ip=obj.start_ip,
                        end_ip=obj.end_ip,
                        associated_interface=obj.associated_interface,
                        comment=obj.comment,
                    )
                    for obj in objects
                ],
            ))

        internal_links = [link.model_dump() for link in snapshot_data.internal_links]
        external_peers = [peer.model_dump() for peer in snapshot_data.external_peers]
        subnets = snapshot_data.subnets
    else:
        # Nessuno snapshot: crea VDOM base dalle policies raccolte
        for vdom_name in vdom_policies.keys():
            policies = vdom_policies.get(vdom_name, [])
            objects = vdom_objects.get(vdom_name, [])
            vdoms_full.append(VdomDetailFull(
                name=vdom_name,
                policies=[
                    PolicyPublic(
                        policy_id=p.policy_id,
                        name=p.name,
                        src_interfaces=p.src_interfaces,
                        dst_interfaces=p.dst_interfaces,
                        src_addresses=p.src_addresses,
                        dst_addresses=p.dst_addresses,
                        services=p.services,
                        action=p.action,
                        status=p.status,
                        log_traffic=p.log_traffic,
                        bytes=p.bytes,
                        hit_count=p.hit_count,
                        comments=p.comments,
                    )
                    for p in policies
                ],
                address_objects=[
                    AddressObjectPublic(
                        name=obj.name,
                        type=obj.type,
                        subnet=obj.subnet,
                        fqdn=obj.fqdn,
                        start_ip=obj.start_ip,
                        end_ip=obj.end_ip,
                        associated_interface=obj.associated_interface,
                        comment=obj.comment,
                    )
                    for obj in objects
                ],
            ))
        internal_links = []
        external_peers = []
        subnets = []

    return FirewallDetailResponse(
        device_id=device_id,
        system_status=system_status,
        system_resources=system_resources,
        vdoms=vdoms_full,
        internal_links=internal_links,
        external_peers=external_peers,
        subnets=subnets,
    )


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.api:app",
        host="0.0.0.0",
        port=8080,
        reload=True,
        log_level="info",
    )
