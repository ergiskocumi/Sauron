#!/usr/bin/env python3
"""
SAURON - Multi-Firewall Network Discovery Tool

Entry point CLI per la scansione parallela di firewall FortiGate.
Scopre VDOM, rotte e interfacce su inventari multi-firewall.
Costruisce topologia di rete e simula percorsi pacchetti.

Usage:
    python main.py
    python main.py --inventory custom.json
    python main.py --debug
    python main.py --build-topology
    python main.py --trace-path --src fw1:root --dst 10.0.0.5
"""

import asyncio
import argparse
import logging
import sys
import time
from typing import List, Optional, Dict, Tuple, Any

from core.config import get_settings
from core.inventory import InventoryLoader
from domain.models import FirewallConfig, ScanResult, Vdom, Route, NetworkInterface
from domain.ports import FirewallRepositoryError
from infrastructure.fortigate_client import FortiGateClient

# Application layer imports
from application.models.topology import Node, InterfaceRecord, Topology
from application.models.pathfinder import PathStatus, PathResult
from application.services.topology_service import TopologyService, interfaces_from_network_interfaces
from application.services.pathfinder_service import PathfinderService


def setup_logging(debug: bool = False) -> None:
    """
    Configura il sistema di logging.

    Args:
        debug: Se True, imposta livello DEBUG
    """
    settings = get_settings()
    level = logging.DEBUG if debug else getattr(logging, settings.log_level.upper())

    logging.basicConfig(
        level=level,
        format=settings.log_format,
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Riduci verbosita' di httpx in modalita' non-debug
    if not debug:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)


logger = logging.getLogger(__name__)


async def scan_single_firewall(
    fw_config: FirewallConfig,
    semaphore: asyncio.Semaphore,
    collect_for_topology: bool = False,
) -> Tuple[ScanResult, Optional[List[InterfaceRecord]], Optional[Dict[str, List[Route]]]]:
    """
    Scansiona un singolo firewall e raccoglie i risultati.

    Args:
        fw_config: Configurazione del firewall
        semaphore: Semaforo per limitare la concorrenza
        collect_for_topology: Se True, raccoglie anche dati per topology

    Returns:
        Tuple di (ScanResult, interfaces, routes_by_vdom)
    """
    start_time = time.perf_counter()
    total_routes = 0
    total_interfaces = 0
    vdoms_found: List[Vdom] = []

    # Dati per topology
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

                # FASE 1: Scoperta VDOM
                print("\n  [1/2] Ricerca VDOM attivi...")
                vdoms_found = await client.get_vdoms()
                vdom_names = [v.name for v in vdoms_found]
                print(f"        Trovati {len(vdoms_found)} VDOM: {', '.join(vdom_names)}")

                # FASE 2: Analisi per ogni VDOM
                print("\n  [2/2] Analisi dettagliata per VDOM...")

                for vdom in vdoms_found:
                    print(f"\n      VDOM: '{vdom.name}'")
                    node_key = f"{fw_config.id}:{vdom.name}"

                    # Routing
                    try:
                        routes = await client.get_routing_table(vdom=vdom.name)
                        total_routes += len(routes)

                        # Store for topology
                        if collect_for_topology:
                            routes_by_vdom[node_key] = routes

                        real_routes = [r for r in routes if r.protocol != "connected"]
                        print(f"        Routing: {len(routes)} rotte ({len(real_routes)} OSPF/Static)")

                        if routes:
                            _print_routes_table(routes[:10])
                            if len(routes) > 10:
                                print(f"        ... altre {len(routes) - 10} nascoste")

                    except FirewallRepositoryError as e:
                        logger.warning(f"Errore routing per VDOM '{vdom.name}': {e}")
                        print(f"        Routing: ERRORE - {e}")

                    # Interfacce (tutte, non solo VLAN per topology)
                    try:
                        interfaces = await client.get_interfaces(vdom=vdom.name)

                        # Collect for topology
                        if collect_for_topology:
                            records = interfaces_from_network_interfaces(
                                device_id=fw_config.id,
                                network_interfaces=interfaces,
                            )
                            all_interfaces.extend(records)

                        # Filtra solo VLAN per display
                        vlans = [i for i in interfaces if i.type == "vlan"]
                        total_interfaces += len(vlans)

                        if vlans:
                            print(f"        VLAN: {len(vlans)} interfacce")
                            for v in vlans[:5]:
                                status = "UP" if v.is_up else "DOWN"
                                vlan_id = v.vlan_id if v.vlan_id else "?"
                                print(f"          - [{vlan_id:>4}] {v.name:<15} {v.ip:<15} [{status}]")
                            if len(vlans) > 5:
                                print(f"          ... altre {len(vlans) - 5}")
                        else:
                            print("        VLAN: nessuna")

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

            return (
                scan_result,
                all_interfaces if collect_for_topology else None,
                routes_by_vdom if collect_for_topology else None,
            )

        except FirewallRepositoryError as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Errore scansione {fw_config.id}: {e}")
            print(f"\n  ERRORE: {e}")

            return (
                ScanResult(
                    firewall_id=fw_config.id,
                    firewall_host=fw_config.host,
                    success=False,
                    error_message=str(e),
                    scan_duration_ms=duration_ms,
                ),
                None,
                None,
            )

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(f"Errore imprevisto su {fw_config.id}: {e}")
            print(f"\n  ERRORE CRITICO: {e}")

            return (
                ScanResult(
                    firewall_id=fw_config.id,
                    firewall_host=fw_config.host,
                    success=False,
                    error_message=f"Errore imprevisto: {e}",
                    scan_duration_ms=duration_ms,
                ),
                None,
                None,
            )


def _print_routes_table(routes: list) -> None:
    """Stampa una tabella formattata delle rotte."""
    print(f"        {'-'*62}")
    print(f"        {'DESTINATION':<20} {'GATEWAY':<16} {'PROTO':<8} {'INTF'}")
    print(f"        {'-'*62}")

    # Ordina: prima le default route
    sorted_routes = sorted(routes, key=lambda x: (not x.is_default_route, x.destination))

    for r in sorted_routes:
        proto = r.protocol[:7]  # Tronca per spazio
        print(f"        {r.destination:<20} {r.gateway:<16} {proto:<8} {r.interface}")


def _print_topology_summary(topology: Topology) -> None:
    """Stampa riepilogo della topologia."""
    print(f"\n{'='*60}")
    print("  TOPOLOGIA DI RETE")
    print(f"{'='*60}")

    print(f"\n  Nodi (Device:VDOM): {topology.node_count}")
    for node_key in sorted(topology.nodes):
        neighbors = topology.get_neighbors(node_key)
        neighbor_count = len(neighbors)
        print(f"    - {node_key} ({neighbor_count} vicini)")

    print(f"\n  Link (Subnet condivise): {topology.link_count}")
    for link in topology.links:
        p2p = " [P2P]" if link.is_point_to_point else ""
        print(f"    - {link.subnet}{p2p}")
        print(f"      Nodi: {', '.join(sorted(link.endpoints))}")

    print(f"\n{'='*60}")


def _print_path_result(result: PathResult) -> None:
    """Stampa il risultato del pathfinding."""
    print(f"\n{'='*60}")
    print("  TRACEROUTE SIMULATO")
    print(f"{'='*60}")

    print(f"\n  Sorgente: {result.source_node.node_key}")
    print(f"  Destinazione: {result.target_ip}")
    print(f"  Stato: {result.status.value.upper()}")

    if result.hops:
        print(f"\n  Percorso ({result.total_hops} hop):")
        for i, hop in enumerate(result.hops, 1):
            route_info = ""
            if hop.matched_route_destination:
                route_info = f" (via {hop.matched_route_destination})"
            print(f"    {i}. {hop.node.node_key}")
            print(f"       Interfaccia uscita: {hop.egress_interface or 'N/A'}")
            print(f"       Azione: {hop.action}{route_info}")
            if hop.next_hop_ip:
                print(f"       Next-hop: {hop.next_hop_ip}")

    if result.status == PathStatus.REACHED:
        print(f"\n  Destinazione raggiunta via {result.exit_interface}")
    elif result.status == PathStatus.EXIT_WAN:
        print(f"\n  Pacchetto esce verso WAN via gateway {result.exit_gateway}")
    elif result.status == PathStatus.LOOP:
        print(f"\n  ATTENZIONE: Rilevato loop di routing!")
    elif result.status == PathStatus.DROPPED:
        print(f"\n  Pacchetto droppato: {result.failure_reason}")

    print(f"\n{'='*60}")


async def main(
    inventory_file: Optional[str] = None,
    debug: bool = False,
    build_topology: bool = False,
    trace_path: bool = False,
    trace_src: Optional[str] = None,
    trace_dst: Optional[str] = None,
) -> int:
    """
    Entry point principale della scansione.

    Args:
        inventory_file: Path custom del file inventory
        debug: Abilita logging debug
        build_topology: Se True, costruisce e mostra la topologia
        trace_path: Se True, simula il percorso di un pacchetto
        trace_src: Nodo sorgente per trace (formato device:vdom)
        trace_dst: IP destinazione per trace

    Returns:
        Exit code (0 = successo, 1 = errori)
    """
    setup_logging(debug=debug)
    settings = get_settings()

    print(f"\n{'='*60}")
    print(f"  SAURON - Multi-Firewall Network Discovery")
    print(f"  Version: {settings.app_version}")
    print(f"{'='*60}")

    # Caricamento inventario
    inventory_path = inventory_file or settings.inventory_file
    loader = InventoryLoader(inventory_path)

    try:
        firewall_configs = loader.load()
    except SystemExit:
        return 1

    # Filtra solo i firewall abilitati
    enabled_firewalls = [fw for fw in firewall_configs if fw.enabled]

    if not enabled_firewalls:
        print("\nNessun firewall abilitato nell'inventario.")
        return 1

    print(f"\n  Firewall nell'inventario: {len(firewall_configs)}")
    print(f"  Firewall abilitati: {len(enabled_firewalls)}")
    print(f"  Modalita scansione: {'Parallela' if settings.parallel_scans else 'Sequenziale'}")

    # Determina se raccogliere dati per topology
    collect_for_topology = build_topology or trace_path

    # Scansione
    start_time = time.perf_counter()
    semaphore = asyncio.Semaphore(settings.max_parallel_firewalls)

    if settings.parallel_scans:
        tasks = [
            scan_single_firewall(fw, semaphore, collect_for_topology)
            for fw in enabled_firewalls
        ]
        scan_results = await asyncio.gather(*tasks)
    else:
        scan_results = []
        for fw in enabled_firewalls:
            result = await scan_single_firewall(fw, semaphore, collect_for_topology)
            scan_results.append(result)

    total_duration = time.perf_counter() - start_time

    # Estrai risultati
    results = [r[0] for r in scan_results]
    all_interfaces: List[InterfaceRecord] = []
    all_routes: Dict[str, List[Route]] = {}

    for _, interfaces, routes in scan_results:
        if interfaces:
            all_interfaces.extend(interfaces)
        if routes:
            all_routes.update(routes)

    # Report finale scansione
    _print_summary(results, total_duration)

    # Costruzione topologia se richiesto
    topology: Optional[Topology] = None
    if collect_for_topology and all_interfaces:
        print("\n  Costruzione topologia in corso...")
        topology_service = TopologyService()
        topology = topology_service.build_topology(all_interfaces)
        _print_topology_summary(topology)

    # Trace path se richiesto
    if trace_path and topology and trace_src and trace_dst:
        print(f"\n  Simulazione percorso: {trace_src} -> {trace_dst}")

        # Parse source node
        src_parts = trace_src.split(":", 1)
        if len(src_parts) != 2:
            print(f"  ERRORE: Formato sorgente non valido. Usa 'device:vdom'")
            return 1

        start_node = Node(device_id=src_parts[0], vdom=src_parts[1])

        if start_node.node_key not in topology.nodes:
            print(f"  ERRORE: Nodo sorgente '{trace_src}' non trovato nella topologia")
            print(f"  Nodi disponibili: {', '.join(sorted(topology.nodes))}")
            return 1

        pathfinder = PathfinderService()
        path_result = pathfinder.find_path(
            topology=topology,
            routing_tables=all_routes,
            start_node=start_node,
            target_ip=trace_dst,
        )

        _print_path_result(path_result)

    # Return exit code
    failed = sum(1 for r in results if not r.success)
    return 1 if failed > 0 else 0


def _print_summary(results: List[ScanResult], total_duration: float) -> None:
    """Stampa il report riassuntivo della scansione."""
    print(f"\n{'='*60}")
    print("  RIEPILOGO SCANSIONE")
    print(f"{'='*60}")

    success_count = sum(1 for r in results if r.success)
    failed_count = len(results) - success_count
    total_vdoms = sum(r.vdoms_count for r in results)
    total_routes = sum(r.routes_count for r in results)
    total_interfaces = sum(r.interfaces_count for r in results)

    print(f"\n  Firewall scansionati: {len(results)}")
    print(f"    - Successo: {success_count}")
    print(f"    - Falliti:  {failed_count}")

    print(f"\n  Dati raccolti:")
    print(f"    - VDOM totali:      {total_vdoms}")
    print(f"    - Rotte totali:     {total_routes}")
    print(f"    - Interfacce VLAN:  {total_interfaces}")

    print(f"\n  Durata totale: {total_duration:.2f}s")

    if failed_count > 0:
        print(f"\n  Firewall con errori:")
        for r in results:
            if not r.success:
                print(f"    - {r.firewall_id}: {r.error_message}")

    print(f"\n{'='*60}")
    print("  Scansione completata.")
    print(f"{'='*60}\n")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="SAURON - Multi-Firewall Network Discovery Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Esempi:
  python main.py                           # Scansione base
  python main.py --build-topology          # Costruisce topologia
  python main.py --trace-path --src fw1:root --dst 10.0.0.5
                                           # Simula percorso pacchetto
        """,
    )
    parser.add_argument(
        "-i", "--inventory",
        type=str,
        default=None,
        help="Path al file inventory JSON (default: inventory.json)",
    )
    parser.add_argument(
        "-d", "--debug",
        action="store_true",
        help="Abilita logging debug verboso",
    )
    parser.add_argument(
        "-s", "--sequential",
        action="store_true",
        help="Disabilita scansione parallela",
    )

    # Topology options
    parser.add_argument(
        "--build-topology",
        action="store_true",
        help="Costruisce e mostra la topologia di rete",
    )

    # Pathfinding options
    parser.add_argument(
        "--trace-path",
        action="store_true",
        help="Simula il percorso di un pacchetto",
    )
    parser.add_argument(
        "--src",
        type=str,
        default=None,
        help="Nodo sorgente per trace (formato: device:vdom)",
    )
    parser.add_argument(
        "--dst",
        type=str,
        default=None,
        help="IP destinazione per trace",
    )

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Validazione argomenti trace
    if args.trace_path:
        if not args.src or not args.dst:
            print("ERRORE: --trace-path richiede --src e --dst")
            sys.exit(1)

    # Override settings se richiesto
    if args.sequential:
        # Hack temporaneo - in futuro usare dependency injection
        settings = get_settings()
        object.__setattr__(settings, "parallel_scans", False)

    exit_code = asyncio.run(main(
        inventory_file=args.inventory,
        debug=args.debug,
        build_topology=args.build_topology,
        trace_path=args.trace_path,
        trace_src=args.src,
        trace_dst=args.dst,
    ))

    sys.exit(exit_code)
