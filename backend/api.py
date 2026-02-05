"""
SAURON REST API - FastAPI Backend

Espone le funzionalità del progetto Sauron tramite API REST.
Riusa completamente i servizi esistenti senza riscrivere la logica.

Endpoints:
- GET  /api/inventory         - Lista firewall (token oscurato)
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
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Domain & Core
from domain.models import FirewallConfig
from core.inventory import InventoryLoader, InventoryError

# Infrastructure
from infrastructure.snapshot_repository import (
    SnapshotRepository,
    SnapshotNotFoundError,
    SnapshotCorruptedError,
)
from infrastructure.fortigate_client import FortiGateClient

# Application Services
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

# CORS Configuration (per frontend React/Vue/Angular)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React default
        "http://localhost:5173",  # Vite default
        "http://localhost:8080",  # Vue CLI default
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    except SystemExit:
        # InventoryLoader chiama sys.exit() in caso di errore
        raise HTTPException(
            status_code=500,
            detail="Inventory file not found or invalid",
        )
    except Exception as e:
        logger.error(f"Unexpected error loading inventory: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


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
    # Aggiungi task in background
    background_tasks.add_task(_perform_scan)

    return ScanResponse(
        status="started",
        message="Network scan started. Check /api/snapshot/status for completion.",
    )


async def _perform_scan():
    """
    Funzione background per eseguire la scansione completa.

    Steps:
    1. Carica inventory
    2. Connette ai firewall
    3. Esegue TopologyService.build_from_firewalls()
    4. Crea NetworkSnapshot
    5. Salva su disco
    """
    logger.info("Background scan started")

    try:
        # Step 1: Carica inventory
        loader = InventoryLoader("inventory.json")
        configs = loader.load()

        # Filtra solo firewall abilitati
        enabled_configs = [cfg for cfg in configs if cfg.enabled]
        logger.info(f"Scanning {len(enabled_configs)} enabled firewalls")

        # Step 2: Crea client FortiGate
        clients = []
        for config in enabled_configs:
            client = FortiGateClient(
                ip_address=config.host,
                api_token=config.token,
            )
            await client.connect()
            clients.append((config.id, client))

        try:
            # Step 3: Build topology
            topology_service = TopologyService()
            topology, routing_tables = await topology_service.build_from_firewalls(clients)

            # Step 4: Crea snapshot
            # Raccogliamo anche le interfacce per lo snapshot
            all_interfaces = []
            for link in topology.links:
                all_interfaces.extend(link.interfaces)

            # Metadati firewall
            firewalls_metadata = []
            from application.models.snapshot import FirewallMetadata

            for config in enabled_configs:
                node_keys = [
                    node_key for node_key in topology.nodes
                    if node_key.startswith(f"{config.id}:")
                ]
                vdoms = [key.split(":", 1)[1] for key in node_keys]

                routes_count = sum(
                    len(routing_tables.get(node_key, []))
                    for node_key in node_keys
                )

                interfaces_count = sum(
                    1 for iface in all_interfaces
                    if iface.device_id == config.id
                )

                firewalls_metadata.append(
                    FirewallMetadata(
                        device_id=config.id,
                        host=config.host,
                        vdoms=vdoms,
                        routes_count=routes_count,
                        interfaces_count=interfaces_count,
                        scan_success=True,
                    )
                )

            snapshot = NetworkSnapshot(
                topology=topology,
                routing_tables=routing_tables,
                interfaces=all_interfaces,
                firewalls_metadata=firewalls_metadata,
            )

            # Step 5: Salva snapshot
            snapshot_repository.save(snapshot, DEFAULT_SNAPSHOT_PATH, overwrite=True)

            logger.info(
                f"Scan completed successfully: "
                f"{snapshot.total_nodes} nodes, {snapshot.total_links} links"
            )

        finally:
            # Disconnetti tutti i client
            for _, client in clients:
                await client.disconnect()

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
            # Check if this is new format (with source/target) or legacy (with endpoints only)
            if link.source and link.target:
                # New directed format
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
            else:
                # Legacy format: derive directed edges from endpoints
                endpoints = list(link.get_endpoints()) if hasattr(link, 'get_endpoints') else list(link.endpoints) if link.endpoints else []
                if len(endpoints) >= 2:
                    # Create pairwise bidirectional edges
                    for i in range(len(endpoints)):
                        for j in range(len(endpoints)):
                            if i != j:
                                links_serialized.append({
                                    "source": endpoints[i],
                                    "target": endpoints[j],
                                    "subnet": link.subnet,
                                    "source_interface": link.interfaces[0].iface_name if link.interfaces else "",
                                    "target_ip": "",
                                    "cost": link.cost if hasattr(link, 'cost') else 1,
                                    "protocol": link.protocol if hasattr(link, 'protocol') else "connected",
                                    "distance": link.distance if hasattr(link, 'distance') else 0,
                                    "bandwidth_mbps": link.bandwidth_mbps if hasattr(link, 'bandwidth_mbps') else None,
                                    "latency_ms": link.latency_ms if hasattr(link, 'latency_ms') else None,
                                    "reliability": link.reliability if hasattr(link, 'reliability') else None,
                                    "is_point_to_point": link.is_point_to_point if hasattr(link, 'is_point_to_point') else False,
                                    "endpoints": endpoints,
                                    "endpoint_count": len(endpoints),
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
            target_ip = resolver.resolve_target_ip(request.destination)
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
