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

Run:
    uvicorn backend.api:app --reload

Test interattivo:
    http://127.0.0.1:8080/docs
"""

from __future__ import annotations

import asyncio
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
from domain.models import FirewallConfig
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

    @classmethod
    def from_config(cls, config: FirewallConfig) -> "FirewallConfigPublic":
        """Converte FirewallConfig in versione pubblica."""
        return cls(
            id=config.id,
            host=config.host,
            entry_vdom=config.entry_vdom,
            enabled=config.enabled,
        )


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
    Restituisce la lista dei firewall dall'inventory.json.

    IMPORTANTE: Il campo 'token' viene oscurato per sicurezza.

    Returns:
        Lista di firewall configurati

    Raises:
        404: Se inventory.json non esiste
        500: Se inventory.json non è valido
    """
    try:
        loader = InventoryLoader("inventory.json")
        configs = loader.load()

        # Converti in versione pubblica (senza token)
        return [FirewallConfigPublic.from_config(cfg) for cfg in configs]

    except InventoryError as e:
        logger.error(f"Inventory error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error loading inventory: {e}")
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
