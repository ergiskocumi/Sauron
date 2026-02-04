"""
GRAPHVIZ PRESENTER - Genera grafi DOT per il percorso

Crea una rappresentazione Graphviz del PathResult.
Utile per esportare il percorso in file .dot.
"""

from __future__ import annotations

from typing import List, Optional

from application.models.pathfinder import PathResult, PathStatus


class GraphvizPresenter:
    """Presenter per esportare il path in formato Graphviz DOT."""

    def build_path_graph(self, result: PathResult, title: Optional[str] = None) -> str:
        """Genera una stringa DOT per il percorso."""
        lines: List[str] = []

        lines.append("digraph Path {")
        lines.append("  rankdir=LR;")
        lines.append("  node [shape=box, style=rounded];")

        if title:
            safe_title = self._escape(title)
            lines.append(f"  label=\"{safe_title}\";")
            lines.append("  labelloc=top;")
            lines.append("  fontsize=14;")

        # Create hop nodes
        hop_ids = []
        for idx, hop in enumerate(result.hops):
            node_id = f"n{idx}"
            hop_ids.append(node_id)
            label = self._escape(hop.node.node_key)
            lines.append(f"  {node_id} [label=\"{label}\"]; ")

        # Determine terminal node
        terminal_id = "t0"
        terminal_label, terminal_color = self._terminal_label_and_color(result)
        lines.append(
            f"  {terminal_id} [label=\"{self._escape(terminal_label)}\", color=\"{terminal_color}\"];"
        )

        # If no hops, connect source directly
        if not hop_ids:
            source_label = self._escape(result.source_node.node_key)
            lines.append(f"  n0 [label=\"{source_label}\"]; ")
            hop_ids = ["n0"]

        # Build edges
        for idx, hop_id in enumerate(hop_ids):
            edge_label = self._edge_label(result, idx)
            if idx < len(hop_ids) - 1:
                next_id = hop_ids[idx + 1]
                lines.append(f"  {hop_id} -> {next_id} [label=\"{edge_label}\"]; ")
            else:
                lines.append(f"  {hop_id} -> {terminal_id} [label=\"{edge_label}\"]; ")

        lines.append("}")
        return "\n".join(lines)

    def _terminal_label_and_color(self, result: PathResult) -> tuple[str, str]:
        if result.status == PathStatus.REACHED:
            return f"target: {result.target_ip}", "green"
        if result.status == PathStatus.EXIT_WAN:
            gateway = result.exit_gateway or "unknown"
            return f"wan: {gateway}", "orange"
        if result.status == PathStatus.TTL_EXCEEDED:
            return "ttl exceeded", "orange"
        if result.status == PathStatus.LOOP:
            return "loop", "red"
        if result.status == PathStatus.NO_NEIGHBOR:
            return "no neighbor", "red"
        return "dropped", "red"

    def _edge_label(self, result: PathResult, idx: int) -> str:
        if idx >= len(result.hops):
            return ""

        hop = result.hops[idx]
        parts: List[str] = []

        if hop.egress_interface:
            parts.append(f"if={self._escape(hop.egress_interface)}")
        if hop.next_hop_ip:
            parts.append(f"gw={self._escape(hop.next_hop_ip)}")

        if not parts:
            return ""

        return "\\n".join(parts)

    @staticmethod
    def _escape(text: str) -> str:
        return text.replace("\\", "\\\\").replace("\"", "\\\"")
