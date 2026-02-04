#!/usr/bin/env python3
"""
SAURON - Multi-Firewall Network Discovery Tool

Entry point CLI per la scansione parallela di firewall FortiGate.
Scopre VDOM, rotte e interfacce su inventari multi-firewall.

Usage:
    python main.py
    python main.py --inventory custom.json
    python main.py --debug
"""

import asyncio
import argparse
import logging
import sys
import time
from typing import List, Optional

from core.config import get_settings
from core.inventory import InventoryLoader
from domain.models import FirewallConfig, ScanResult, Vdom
from domain.ports import FirewallRepositoryError
from infrastructure.fortigate_client import FortiGateClient


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

    # Riduci verbosità di httpx in modalità non-debug
    if not debug:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)


logger = logging.getLogger(__name__)


async def scan_single_firewall(
    fw_config: FirewallConfig,
    semaphore: asyncio.Semaphore,
) -> ScanResult:
    """
    Scansiona un singolo firewall e raccoglie i risultati.

    Args:
        fw_config: Configurazione del firewall
        semaphore: Semaforo per limitare la concorrenza

    Returns:
        ScanResult con i dati aggregati della scansione
    """
    start_time = time.perf_counter()
    total_routes = 0
    total_interfaces = 0
    vdoms_found: List[Vdom] = []

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

                    # Routing
                    try:
                        routes = await client.get_routing_table(vdom=vdom.name)
                        total_routes += len(routes)

                        real_routes = [r for r in routes if r.protocol != "connected"]
                        print(f"        Routing: {len(routes)} rotte ({len(real_routes)} OSPF/Static)")

                        if routes:
                            _print_routes_table(routes[:10])
                            if len(routes) > 10:
                                print(f"        ... altre {len(routes) - 10} nascoste")

                    except FirewallRepositoryError as e:
                        logger.warning(f"Errore routing per VDOM '{vdom.name}': {e}")
                        print(f"        Routing: ERRORE - {e}")

                    # Interfacce VLAN
                    try:
                        vlans = await client.get_interfaces(
                            vdom=vdom.name,
                            type_filter="vlan"
                        )
                        total_interfaces += len(vlans)

                        if vlans:
                            print(f"        VLAN: {len(vlans)} interfacce")
                            for v in vlans[:5]:
                                status = "UP" if v.is_up else "DOWN"
                                print(f"          - [{v.vlan_id:>4}] {v.name:<15} {v.ip:<15} [{status}]")
                            if len(vlans) > 5:
                                print(f"          ... altre {len(vlans) - 5}")
                        else:
                            print("        VLAN: nessuna")

                    except FirewallRepositoryError as e:
                        logger.warning(f"Errore VLAN per VDOM '{vdom.name}': {e}")
                        print(f"        VLAN: ERRORE - {e}")

            duration_ms = (time.perf_counter() - start_time) * 1000

            return ScanResult(
                firewall_id=fw_config.id,
                firewall_host=fw_config.host,
                success=True,
                vdoms_count=len(vdoms_found),
                routes_count=total_routes,
                interfaces_count=total_interfaces,
                scan_duration_ms=duration_ms,
            )

        except FirewallRepositoryError as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Errore scansione {fw_config.id}: {e}")
            print(f"\n  ERRORE: {e}")

            return ScanResult(
                firewall_id=fw_config.id,
                firewall_host=fw_config.host,
                success=False,
                error_message=str(e),
                scan_duration_ms=duration_ms,
            )

        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.exception(f"Errore imprevisto su {fw_config.id}: {e}")
            print(f"\n  ERRORE CRITICO: {e}")

            return ScanResult(
                firewall_id=fw_config.id,
                firewall_host=fw_config.host,
                success=False,
                error_message=f"Errore imprevisto: {e}",
                scan_duration_ms=duration_ms,
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


async def main(inventory_file: Optional[str] = None, debug: bool = False) -> int:
    """
    Entry point principale della scansione.

    Args:
        inventory_file: Path custom del file inventory
        debug: Abilita logging debug

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

    # Scansione
    start_time = time.perf_counter()
    semaphore = asyncio.Semaphore(settings.max_parallel_firewalls)

    if settings.parallel_scans:
        tasks = [
            scan_single_firewall(fw, semaphore)
            for fw in enabled_firewalls
        ]
        results = await asyncio.gather(*tasks)
    else:
        results = []
        for fw in enabled_firewalls:
            result = await scan_single_firewall(fw, semaphore)
            results.append(result)

    total_duration = time.perf_counter() - start_time

    # Report finale
    _print_summary(results, total_duration)

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

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Override settings se richiesto
    if args.sequential:
        # Hack temporaneo - in futuro usare dependency injection
        settings = get_settings()
        object.__setattr__(settings, "parallel_scans", False)

    exit_code = asyncio.run(main(
        inventory_file=args.inventory,
        debug=args.debug,
    ))

    sys.exit(exit_code)
