"""
CONSOLE PRESENTER - Output testuale su terminale

Gestisce la visualizzazione dei risultati sul terminale
in modo consistente e separato dalla logica applicativa.
"""

from __future__ import annotations

from typing import Optional

from application.models.pathfinder import PathResult, PathStatus
from application.services.resolver_service import ResolverError


class ConsolePresenter:
    """Presenter per output su console."""

    def print_path_result(self, result: PathResult) -> None:
        """Stampa il risultato del pathfinding."""
        print(f"\n{'='*60}")
        print("  TRACEROUTE SIMULATO")
        print(f"{'='*60}")

        status_label = {
            PathStatus.REACHED: "[OK]",
            PathStatus.DROPPED: "[DROP]",
            PathStatus.LOOP: "[LOOP]",
            PathStatus.TTL_EXCEEDED: "[TTL]",
            PathStatus.EXIT_WAN: "[WAN]",
            PathStatus.NO_NEIGHBOR: "[!NH]",
        }

        print(f"\n  Sorgente: {result.source_node.node_key}")
        print(f"  Destinazione: {result.target_ip}")
        print(
            f"  Stato: {status_label.get(result.status, '[?]')} "
            f"{result.status.value.upper()}"
        )

        if result.hops:
            print(f"\n  Percorso ({result.total_hops} hop):")
            print(f"  {'-'*56}")

            for i, hop in enumerate(result.hops, 1):
                print(f"  {i}. {hop.node.node_key}")

                ingress_label = hop.ingress_interface
                if not ingress_label:
                    ingress_label = "LOCAL" if i == 1 else "N/A"
                print(f"     Ingresso: {ingress_label}")

                egress_label = hop.egress_interface or "N/A"
                print(f"     Uscita: {egress_label}")

                if hop.matched_route_destination:
                    gw = hop.matched_route_gateway or "direct"
                    print(f"     Route: {hop.matched_route_destination} via {gw}")

                print(f"     Azione: {hop.action}")

                if hop.next_hop_ip:
                    print(f"     Next-hop: {hop.next_hop_ip}")

                print()

        # Conclusione
        if result.status == PathStatus.REACHED:
            print(f"  Destinazione raggiunta via {result.exit_interface}")
        elif result.status == PathStatus.EXIT_WAN:
            print(f"  Pacchetto esce verso WAN via gateway {result.exit_gateway}")
        elif result.status == PathStatus.LOOP:
            print("  ATTENZIONE: Rilevato loop di routing!")
        elif result.status == PathStatus.DROPPED:
            print(f"  Pacchetto droppato: {result.failure_reason}")
        elif result.status == PathStatus.TTL_EXCEEDED:
            print(f"  TTL esaurito dopo {result.total_hops} hop")

        print(f"\n{'='*60}\n")

    def print_resolver_error(self, error: ResolverError) -> None:
        """Stampa un errore del resolver con eventuali suggerimenti."""
        print(f"ERRORE: {error}")
        candidates = getattr(error, "candidates", None)
        if candidates:
            print("Possibili opzioni:")
            for candidate in candidates:
                print(f"  - {candidate}")

    def print_message(self, message: str, header: Optional[str] = None) -> None:
        """Stampa un messaggio opzionalmente con intestazione."""
        if header:
            print(f"\n{'='*60}")
            print(f"  {header}")
            print(f"{'='*60}")
        print(message)
