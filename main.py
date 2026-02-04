#!/usr/bin/env python3
"""
SAURON - Multi-Firewall Network Discovery Tool

Entry point CLI per la scansione parallela di firewall FortiGate.
Scopre VDOM, rotte e interfacce su inventari multi-firewall.
Costruisce topologia di rete e simula percorsi pacchetti.

Comandi:
    sauron scan     - Scansiona firewall e salva snapshot
    sauron topology - Mostra topologia dallo snapshot
    sauron path     - Simula percorso pacchetto
    sauron info     - Mostra informazioni snapshot
    sauron demo     - Genera uno snapshot demo offline
    sauron graphviz - Verifica e configura Graphviz (dot)

Esempi:
    python main.py scan -o network.snapshot
    python main.py topology -s network.snapshot
    python main.py path -s network.snapshot --src fw1:root --dst 10.0.0.5
    python main.py info -s network.snapshot
    python main.py demo -o demo.snapshot
    python main.py graphviz --set-env
"""

import asyncio
import argparse
import logging
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime

from core.config import get_settings
from core.inventory import InventoryLoader
from domain.models import FirewallConfig, ScanResult, Vdom, Route
from domain.ports import FirewallRepositoryError
from infrastructure.fortigate_client import FortiGateClient
from infrastructure.snapshot_repository import (
    SnapshotRepository,
    SnapshotNotFoundError,
    SnapshotCorruptedError,
)

from application.models.topology import InterfaceRecord
from application.models.snapshot import NetworkSnapshot, FirewallMetadata
from application.services.topology_service import TopologyService, interfaces_from_network_interfaces
from application.services.pathfinder_service import PathfinderService
from application.services.resolver_service import ResolverService, ResolverError
from application.presenters.console_presenter import ConsolePresenter
from application.presenters.graphviz_presenter import GraphvizPresenter


def setup_logging(debug: bool = False) -> None:
    """Configura il sistema di logging."""
    settings = get_settings()
    level = logging.DEBUG if debug else getattr(logging, settings.log_level.upper())

    logging.basicConfig(
        level=level,
        format=settings.log_format,
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    if not debug:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)


logger = logging.getLogger(__name__)


# =============================================================================
# SCAN COMMAND
# =============================================================================

async def scan_single_firewall(
    fw_config: FirewallConfig,
    semaphore: asyncio.Semaphore,
) -> Tuple[ScanResult, List[InterfaceRecord], Dict[str, List[Route]], FirewallMetadata]:
    """Scansiona un singolo firewall e raccoglie i risultati."""
    start_time = time.perf_counter()
    total_routes = 0
    total_interfaces = 0
    vdoms_found: List[Vdom] = []
    all_interfaces: List[InterfaceRecord] = []
    routes_by_vdom: Dict[str, List[Route]] = {}

    async with semaphore:
        print(f"\n{'#'*60}")
        print(f"  FIREWALL: {fw_config.id.upper()}")
        print(f"  Target: {fw_config.host}")
        print(f"{'#'*60}")

        try:
            async with FortiGateClient(
                ip_address=fw_config.host,
                api_token=fw_config.token,
            ) as client:

                print("\n  [1/2] Ricerca VDOM attivi...")
                vdoms_found = await client.get_vdoms()
                vdom_names = [v.name for v in vdoms_found]
                print(f"        Trovati {len(vdoms_found)} VDOM: {', '.join(vdom_names)}")

                print("\n  [2/2] Analisi dettagliata per VDOM...")

                for vdom in vdoms_found:
                    print(f"\n      VDOM: '{vdom.name}'")
                    node_key = f"{fw_config.id}:{vdom.name}"

                    # Routing
                    try:
                        routes = await client.get_routing_table(vdom=vdom.name)
                        total_routes += len(routes)
                        routes_by_vdom[node_key] = routes

                        real_routes = [r for r in routes if r.protocol != "connected"]
                        print(f"        Routing: {len(routes)} rotte ({len(real_routes)} learned)")

                    except FirewallRepositoryError as e:
                        logger.warning(f"Errore routing per VDOM '{vdom.name}': {e}")
                        print(f"        Routing: ERRORE - {e}")
                        routes_by_vdom[node_key] = []

                    # Interfacce
                    try:
                        interfaces = await client.get_interfaces(vdom=vdom.name)
                        records = interfaces_from_network_interfaces(
                            device_id=fw_config.id,
                            network_interfaces=interfaces,
                        )
                        all_interfaces.extend(records)
                        total_interfaces += len(interfaces)

                        up_count = sum(1 for i in interfaces if i.is_up)
                        print(f"        Interfacce: {len(interfaces)} totali ({up_count} UP)")

                    except FirewallRepositoryError as e:
                        logger.warning(f"Errore interfacce per VDOM '{vdom.name}': {e}")
                        print(f"        Interfacce: ERRORE - {e}")

            duration_ms = (time.perf_counter() - start_time) * 1000

            scan_result = ScanResult(
                firewall_id=fw_config.id,
                firewall_host=fw_config.host,
                success=True,
                vdoms_count=len(vdoms_found),
                routes_count=total_routes,
                interfaces_count=total_interfaces,
                scan_duration_ms=duration_ms,
            )

            metadata = FirewallMetadata(
                device_id=fw_config.id,
                host=fw_config.host,
                vdoms=vdom_names,
                routes_count=total_routes,
                interfaces_count=total_interfaces,
                scan_success=True,
            )

            return scan_result, all_interfaces, routes_by_vdom, metadata

        except FirewallRepositoryError as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Errore scansione {fw_config.id}: {e}")
            print(f"\n  ERRORE: {e}")

            scan_result = ScanResult(
                firewall_id=fw_config.id,
                firewall_host=fw_config.host,
                success=False,
                error_message=str(e),
                scan_duration_ms=duration_ms,
            )

            metadata = FirewallMetadata(
                device_id=fw_config.id,
                host=fw_config.host,
                scan_success=False,
                error_message=str(e),
            )

            return scan_result, [], {}, metadata

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(f"Errore imprevisto su {fw_config.id}: {e}")
            print(f"\n  ERRORE CRITICO: {e}")

            scan_result = ScanResult(
                firewall_id=fw_config.id,
                firewall_host=fw_config.host,
                success=False,
                error_message=f"Errore imprevisto: {e}",
                scan_duration_ms=duration_ms,
            )

            metadata = FirewallMetadata(
                device_id=fw_config.id,
                host=fw_config.host,
                scan_success=False,
                error_message=str(e),
            )

            return scan_result, [], {}, metadata


async def cmd_scan(args: argparse.Namespace) -> int:
    """Comando SCAN: scansiona firewall e salva snapshot."""
    setup_logging(debug=args.debug)
    settings = get_settings()

    print(f"\n{'='*60}")
    print(f"  SAURON - Network Scan")
    print(f"  Version: {settings.app_version}")
    print(f"{'='*60}")

    # Caricamento inventario
    inventory_path = args.inventory or settings.inventory_file
    loader = InventoryLoader(inventory_path)

    try:
        firewall_configs = loader.load()
    except SystemExit:
        return 1

    enabled_firewalls = [fw for fw in firewall_configs if fw.enabled]

    if not enabled_firewalls:
        print("\nNessun firewall abilitato nell'inventario.")
        return 1

    print(f"\n  Firewall nell'inventario: {len(firewall_configs)}")
    print(f"  Firewall abilitati: {len(enabled_firewalls)}")
    print(f"  Output: {args.output}")

    # Scansione
    start_time = time.perf_counter()
    semaphore = asyncio.Semaphore(settings.max_parallel_firewalls)

    if settings.parallel_scans and not args.sequential:
        tasks = [scan_single_firewall(fw, semaphore) for fw in enabled_firewalls]
        scan_results = await asyncio.gather(*tasks)
    else:
        scan_results = []
        for fw in enabled_firewalls:
            result = await scan_single_firewall(fw, semaphore)
            scan_results.append(result)

    total_duration = time.perf_counter() - start_time

    # Aggrega risultati
    results = [r[0] for r in scan_results]
    all_interfaces: List[InterfaceRecord] = []
    all_routes: Dict[str, List[Route]] = {}
    all_metadata: List[FirewallMetadata] = []

    for _, interfaces, routes, metadata in scan_results:
        all_interfaces.extend(interfaces)
        all_routes.update(routes)
        all_metadata.append(metadata)

    # Costruisci topologia
    print("\n  Costruzione topologia...")
    topology_service = TopologyService()
    topology = topology_service.build_topology(all_interfaces)

    # Crea snapshot
    snapshot = NetworkSnapshot(
        topology=topology,
        routing_tables=all_routes,
        interfaces=all_interfaces,
        firewalls_metadata=all_metadata,
        timestamp=datetime.now(),
    )

    # Salva snapshot
    repository = SnapshotRepository(compress=not args.no_compress)
    output_path = repository.save(snapshot, Path(args.output))

    # Report
    _print_scan_summary(results, total_duration, snapshot, output_path)

    failed = sum(1 for r in results if not r.success)
    return 1 if failed > 0 else 0


def _print_scan_summary(
    results: List[ScanResult],
    total_duration: float,
    snapshot: NetworkSnapshot,
    output_path: Path,
) -> None:
    """Stampa il report riassuntivo della scansione."""
    print(f"\n{'='*60}")
    print("  RIEPILOGO SCANSIONE")
    print(f"{'='*60}")

    success_count = sum(1 for r in results if r.success)
    failed_count = len(results) - success_count

    print(f"\n  Firewall scansionati: {len(results)}")
    print(f"    - Successo: {success_count}")
    print(f"    - Falliti:  {failed_count}")

    print(f"\n  Topologia:")
    print(f"    - Nodi:       {snapshot.total_nodes}")
    print(f"    - Link:       {snapshot.total_links}")
    print(f"    - Rotte:      {snapshot.total_routes}")
    print(f"    - Interfacce: {snapshot.total_interfaces}")

    print(f"\n  Snapshot salvato: {output_path}")
    print(f"  Dimensione: {output_path.stat().st_size / 1024:.1f} KB")
    print(f"  Durata totale: {total_duration:.2f}s")

    if failed_count > 0:
        print(f"\n  Firewall con errori:")
        for r in results:
            if not r.success:
                print(f"    - {r.firewall_id}: {r.error_message}")

    print(f"\n{'='*60}")
    print("  Scansione completata.")
    print(f"{'='*60}\n")


# =============================================================================
# TOPOLOGY COMMAND
# =============================================================================

def cmd_topology(args: argparse.Namespace) -> int:
    """Comando TOPOLOGY: mostra la topologia dallo snapshot."""
    setup_logging(debug=args.debug)

    repository = SnapshotRepository()

    try:
        snapshot = repository.load(Path(args.snapshot))
    except SnapshotNotFoundError:
        print(f"ERRORE: Snapshot non trovato: {args.snapshot}")
        return 1
    except SnapshotCorruptedError:
        print(f"ERRORE: Snapshot corrotto: {args.snapshot}")
        return 1

    print(f"\n{'='*60}")
    print("  TOPOLOGIA DI RETE")
    print(f"{'='*60}")
    print(f"\n  Snapshot: {args.snapshot} ({snapshot.age_human} fa)")

    topology = snapshot.topology

    print(f"\n  Nodi ({topology.node_count}):")
    for node_key in sorted(topology.nodes):
        neighbors = topology.get_neighbors(node_key)
        neighbor_count = len(neighbors)
        routes_count = len(snapshot.get_node_routes(node_key))
        print(f"    - {node_key}")
        print(f"      Vicini: {neighbor_count}, Rotte: {routes_count}")

    print(f"\n  Link ({topology.link_count}):")
    for link in topology.links:
        p2p = " [P2P]" if link.is_point_to_point else ""
        print(f"    - {link.subnet}{p2p}")
        print(f"      Connette: {', '.join(sorted(link.endpoints))}")

    print(f"\n{'='*60}\n")
    return 0


# =============================================================================
# PATH COMMAND
# =============================================================================

def cmd_path(args: argparse.Namespace) -> int:
    """Comando PATH: simula percorso pacchetto."""
    setup_logging(debug=args.debug)
    settings = get_settings()
    presenter = ConsolePresenter()

    repository = SnapshotRepository()

    try:
        snapshot = repository.load(Path(args.snapshot))
    except SnapshotNotFoundError:
        print(f"ERRORE: Snapshot non trovato: {args.snapshot}")
        return 1
    except SnapshotCorruptedError:
        print(f"ERRORE: Snapshot corrotto: {args.snapshot}")
        return 1

    resolver = ResolverService(default_vdom=settings.default_vdom)
    try:
        start_node = resolver.resolve_source(args.src, snapshot)
        target_ip = resolver.resolve_target_ip(args.dst)
    except ResolverError as exc:
        presenter.print_resolver_error(exc)
        return 1

    ingress_interface = None
    if args.ingress:
        try:
            ingress_interface = _resolve_ingress_interface(
                start_node=start_node,
                interfaces=snapshot.interfaces,
                ingress_spec=args.ingress,
            )
        except ValueError as exc:
            print(f"ERRORE: {exc}")
            return 1

    # Pathfinding
    pathfinder = PathfinderService()
    result = pathfinder.find_path(
        topology=snapshot.topology,
        routing_tables=snapshot.routing_tables,
        start_node=start_node,
        target_ip=target_ip,
        max_ttl=args.ttl,
        initial_ingress=ingress_interface,
    )

    presenter.print_path_result(result)

    _export_graphviz(
        result=result,
        dot_path=Path(args.dot) if args.dot else None,
        png_path=Path(args.png) if args.png else None,
        dot_exe_override=args.dot_exe,
    )

    return 0 if result.is_reachable else 1


# =============================================================================
# INFO COMMAND
# =============================================================================

def cmd_info(args: argparse.Namespace) -> int:
    """Comando INFO: mostra informazioni snapshot."""
    setup_logging(debug=args.debug)

    repository = SnapshotRepository()

    try:
        snapshot = repository.load(Path(args.snapshot))
    except SnapshotNotFoundError:
        print(f"ERRORE: Snapshot non trovato: {args.snapshot}")
        return 1
    except SnapshotCorruptedError:
        print(f"ERRORE: Snapshot corrotto: {args.snapshot}")
        return 1

    print(f"\n{'='*60}")
    print("  INFORMAZIONI SNAPSHOT")
    print(f"{'='*60}")

    print(f"\n  File: {args.snapshot}")
    print(f"  Versione: {snapshot.version}")
    print(f"  Creato: {snapshot.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Eta': {snapshot.age_human}")

    print(f"\n  Firewall ({snapshot.firewalls_count}):")
    for fw in snapshot.firewalls_metadata:
        status = "OK" if fw.scan_success else "ERRORE"
        print(f"    - {fw.device_id} [{status}]")
        if fw.vdoms:
            print(f"      VDOM: {', '.join(fw.vdoms)}")
        if fw.error_message:
            print(f"      Errore: {fw.error_message}")

    print(f"\n  Statistiche:")
    print(f"    - Nodi:       {snapshot.total_nodes}")
    print(f"    - Link:       {snapshot.total_links}")
    print(f"    - Rotte:      {snapshot.total_routes}")
    print(f"    - Interfacce: {snapshot.total_interfaces}")

    print(f"\n{'='*60}\n")
    return 0


# =============================================================================
# DEMO COMMAND
# =============================================================================

def _build_demo_snapshot() -> NetworkSnapshot:
    """Costruisce uno snapshot demo offline per test rapidi."""
    interfaces = [
        InterfaceRecord(
            device_id="fw1",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("192.168.1.1"),
            prefix_len=24,
            is_up=True,
        ),
        InterfaceRecord(
            device_id="fw2",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("192.168.1.2"),
            prefix_len=24,
            is_up=True,
        ),
        InterfaceRecord(
            device_id="fw2",
            vdom="root",
            iface_name="port2",
            ip=InterfaceRecord._ip_to_int("10.0.0.1"),
            prefix_len=24,
            is_up=True,
        ),
        InterfaceRecord(
            device_id="fw3",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.2"),
            prefix_len=24,
            is_up=True,
        ),
    ]

    topology = TopologyService().build_topology(interfaces)

    routing_tables = {
        "fw1:root": [
            Route(
                ip_mask="192.168.1.0/24",
                gateway="0.0.0.0",
                interface="port1",
                type="connected",
                distance=0,
                metric=0,
            ),
            Route(
                ip_mask="10.0.0.0/24",
                gateway="192.168.1.2",
                interface="port1",
                type="static",
                distance=10,
                metric=0,
            ),
        ],
        "fw2:root": [
            Route(
                ip_mask="192.168.1.0/24",
                gateway="0.0.0.0",
                interface="port1",
                type="connected",
                distance=0,
                metric=0,
            ),
            Route(
                ip_mask="10.0.0.0/24",
                gateway="0.0.0.0",
                interface="port2",
                type="connected",
                distance=0,
                metric=0,
            ),
        ],
        "fw3:root": [
            Route(
                ip_mask="10.0.0.0/24",
                gateway="0.0.0.0",
                interface="port1",
                type="connected",
                distance=0,
                metric=0,
            )
        ],
    }

    metadata = [
        FirewallMetadata(device_id="fw1", host="10.0.0.10:443", vdoms=["root"]),
        FirewallMetadata(device_id="fw2", host="10.0.0.20:443", vdoms=["root"]),
        FirewallMetadata(device_id="fw3", host="10.0.0.30:443", vdoms=["root"]),
    ]

    return NetworkSnapshot(
        topology=topology,
        routing_tables=routing_tables,
        interfaces=interfaces,
        firewalls_metadata=metadata,
        timestamp=datetime.now(),
    )


def cmd_demo(args: argparse.Namespace) -> int:
    """Comando DEMO: genera uno snapshot offline di esempio."""
    setup_logging(debug=args.debug)

    snapshot = _build_demo_snapshot()
    repository = SnapshotRepository(compress=not args.no_compress)
    output_path = repository.save(snapshot, Path(args.output))

    print(f"\n{'='*60}")
    print("  DEMO SNAPSHOT")
    print(f"{'='*60}")
    print(f"\n  Output: {output_path}")
    print(f"  Nodi:       {snapshot.total_nodes}")
    print(f"  Link:       {snapshot.total_links}")
    print(f"  Rotte:      {snapshot.total_routes}")
    print(f"  Interfacce: {snapshot.total_interfaces}")
    print(f"\n{'='*60}\n")

    return 0


# =============================================================================
# GRAPHVIZ COMMAND
# =============================================================================

def cmd_graphviz(args: argparse.Namespace) -> int:
    """Comando GRAPHVIZ: verifica e configura dot."""
    dot_exe = _find_dot_executable(args.dot_exe)

    print(f"\n{'='*60}")
    print("  GRAPHVIZ CHECK")
    print(f"{'='*60}")

    if not dot_exe:
        print("\n  dot non trovato.")
        print("  Suggerimenti:")
        print("  - Installa Graphviz oppure specifica --dot-exe")
        print("  - Imposta GRAPHVIZ_DOT con il path completo")
        print(f"\n{'='*60}\n")
        return 1

    print(f"\n  dot trovato: {dot_exe}")

    if args.set_env:
        _set_graphviz_env(dot_exe)

    print(f"\n{'='*60}\n")
    return 0


def _resolve_ingress_interface(
    start_node: "Node",
    interfaces: List[InterfaceRecord],
    ingress_spec: str,
) -> str:
    """Valida l'interfaccia di ingresso per il nodo sorgente."""
    label = ingress_spec.strip()
    if not label:
        raise ValueError("Interfaccia di ingresso vuota.")

    if label.lower() in ("local", "self"):
        return "LOCAL"

    candidates = [
        iface.iface_name
        for iface in interfaces
        if iface.node.node_key == start_node.node_key
    ]

    if not candidates:
        return label

    for name in candidates:
        if name == label:
            return name

    for name in candidates:
        if name.lower() == label.lower():
            return name

    raise ValueError(
        "Interfaccia di ingresso non trovata. "
        f"Opzioni disponibili: {', '.join(sorted(candidates))}"
    )


def _export_graphviz(
    result: "PathResult",
    dot_path: Path | None,
    png_path: Path | None,
    dot_exe_override: str | None,
) -> None:
    """Esporta il percorso in formato DOT/PNG se richiesto."""
    if not dot_path and not png_path:
        return

    presenter = GraphvizPresenter()
    title = f"{result.source_node.node_key} -> {result.target_ip}"
    dot_content = presenter.build_path_graph(result, title=title)

    if dot_path:
        dot_path.parent.mkdir(parents=True, exist_ok=True)
        dot_path.write_text(dot_content, encoding="utf-8")
        print(f"Graphviz salvato: {dot_path}")

    if png_path:
        png_path.parent.mkdir(parents=True, exist_ok=True)

        if dot_path is None:
            dot_path = png_path.with_suffix(".dot")
            dot_path.write_text(dot_content, encoding="utf-8")
            print(f"Graphviz salvato: {dot_path}")

        dot_exe = _find_dot_executable(dot_exe_override)
        if not dot_exe:
            print(
                "ATTENZIONE: Graphviz 'dot' non trovato, salto rendering PNG. "
                "Usa --dot-exe o imposta GRAPHVIZ_DOT."
            )
            return

        subprocess.run(
            [dot_exe, "-Tpng", str(dot_path), "-o", str(png_path)],
            check=True,
        )
        print(f"PNG salvato: {png_path}")


def _find_dot_executable(explicit_path: str | None) -> str | None:
    """Trova l'eseguibile Graphviz dot con fallback su path comuni."""
    if explicit_path:
        path = Path(explicit_path)
        if path.exists():
            return str(path)

    env_path = os.getenv("GRAPHVIZ_DOT")
    if env_path:
        path = Path(env_path)
        if path.exists():
            return str(path)

    dot_path = shutil.which("dot")
    if dot_path:
        return dot_path

    candidates = [
        Path(r"C:\Program Files\Graphviz\bin\dot.exe"),
        Path(r"C:\Program Files (x86)\Graphviz\bin\dot.exe"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    for base in (Path(r"C:\Program Files"), Path(r"C:\Program Files (x86)")):
        if base.exists():
            for candidate in base.glob("Graphviz*/bin/dot.exe"):
                return str(candidate)

    return None


def _set_graphviz_env(dot_exe: str) -> None:
    """Imposta GRAPHVIZ_DOT come variabile d'ambiente utente."""
    try:
        subprocess.run(
            ["setx", "GRAPHVIZ_DOT", dot_exe],
            check=True,
            capture_output=True,
            text=True,
        )
        print("  GRAPHVIZ_DOT impostato. Riavvia il terminale per renderlo attivo.")
    except FileNotFoundError:
        print("  setx non disponibile. Imposta GRAPHVIZ_DOT manualmente.")
    except subprocess.CalledProcessError as exc:
        print(f"  Impossibile impostare GRAPHVIZ_DOT: {exc}")


# =============================================================================
# CLI PARSER
# =============================================================================

def create_parser() -> argparse.ArgumentParser:
    """Crea il parser CLI con subcommand."""
    parser = argparse.ArgumentParser(
        prog="sauron",
        description="SAURON - Multi-Firewall Network Discovery Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Comandi:
  scan      Scansiona firewall e salva snapshot
  topology  Mostra topologia dallo snapshot
  path      Simula percorso pacchetto
  info      Mostra informazioni snapshot
  demo      Genera uno snapshot demo offline
  graphviz  Verifica e configura Graphviz (dot)

Esempi:
  %(prog)s scan -o network.snapshot
  %(prog)s topology -s network.snapshot
  %(prog)s path -s network.snapshot --src fw1:root --dst 10.0.0.5
  %(prog)s info -s network.snapshot
  %(prog)s demo -o demo.snapshot
  %(prog)s graphviz --set-env
        """,
    )

    parser.add_argument(
        "-d", "--debug",
        action="store_true",
        help="Abilita logging debug",
    )

    subparsers = parser.add_subparsers(
        title="comandi",
        dest="command",
        required=True,
    )

    # SCAN subcommand
    scan_parser = subparsers.add_parser(
        "scan",
        help="Scansiona firewall e salva snapshot",
    )
    scan_parser.add_argument(
        "-i", "--inventory",
        type=str,
        default=None,
        help="Path al file inventory JSON",
    )
    scan_parser.add_argument(
        "-o", "--output",
        type=str,
        default="network.snapshot",
        help="Path output snapshot (default: network.snapshot)",
    )
    scan_parser.add_argument(
        "-s", "--sequential",
        action="store_true",
        help="Disabilita scansione parallela",
    )
    scan_parser.add_argument(
        "--no-compress",
        action="store_true",
        help="Non comprimere lo snapshot",
    )
    scan_parser.set_defaults(func=cmd_scan)

    # TOPOLOGY subcommand
    topology_parser = subparsers.add_parser(
        "topology",
        help="Mostra topologia dallo snapshot",
    )
    topology_parser.add_argument(
        "-s", "--snapshot",
        type=str,
        required=True,
        help="Path allo snapshot",
    )
    topology_parser.set_defaults(func=cmd_topology)

    # PATH subcommand
    path_parser = subparsers.add_parser(
        "path",
        help="Simula percorso pacchetto",
    )
    path_parser.add_argument(
        "-s", "--snapshot",
        type=str,
        required=True,
        help="Path allo snapshot",
    )
    path_parser.add_argument(
        "--src",
        type=str,
        required=True,
        help="Nodo sorgente (formato: device:vdom)",
    )
    path_parser.add_argument(
        "--dst",
        type=str,
        required=True,
        help="IP destinazione",
    )
    path_parser.add_argument(
        "--ingress",
        type=str,
        default=None,
        help="Interfaccia di ingresso per il primo hop (default: LOCAL)",
    )
    path_parser.add_argument(
        "--ttl",
        type=int,
        default=64,
        help="TTL massimo (default: 64)",
    )
    path_parser.add_argument(
        "--dot",
        type=str,
        default=None,
        help="Path output file .dot (Graphviz)",
    )
    path_parser.add_argument(
        "--png",
        type=str,
        default=None,
        help="Path output file .png (richiede Graphviz)",
    )
    path_parser.add_argument(
        "--dot-exe",
        type=str,
        default=None,
        help="Path esplicito all'eseguibile dot (Graphviz)",
    )
    path_parser.set_defaults(func=cmd_path)

    # INFO subcommand
    info_parser = subparsers.add_parser(
        "info",
        help="Mostra informazioni snapshot",
    )
    info_parser.add_argument(
        "-s", "--snapshot",
        type=str,
        required=True,
        help="Path allo snapshot",
    )
    info_parser.set_defaults(func=cmd_info)

    # DEMO subcommand
    demo_parser = subparsers.add_parser(
        "demo",
        help="Genera uno snapshot demo offline",
    )
    demo_parser.add_argument(
        "-o", "--output",
        type=str,
        default="demo.snapshot",
        help="Path output snapshot (default: demo.snapshot)",
    )
    demo_parser.add_argument(
        "--no-compress",
        action="store_true",
        help="Non comprimere lo snapshot",
    )
    demo_parser.set_defaults(func=cmd_demo)

    # GRAPHVIZ subcommand
    graphviz_parser = subparsers.add_parser(
        "graphviz",
        help="Verifica e configura Graphviz (dot)",
    )
    graphviz_parser.add_argument(
        "--dot-exe",
        type=str,
        default=None,
        help="Path esplicito all'eseguibile dot (Graphviz)",
    )
    graphviz_parser.add_argument(
        "--set-env",
        action="store_true",
        help="Imposta GRAPHVIZ_DOT con il path trovato",
    )
    graphviz_parser.set_defaults(func=cmd_graphviz)

    return parser


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:
    """Entry point principale."""
    parser = create_parser()
    args = parser.parse_args()

    # Esegui il comando appropriato
    if hasattr(args, "func"):
        if asyncio.iscoroutinefunction(args.func):
            return asyncio.run(args.func(args))
        else:
            return args.func(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
