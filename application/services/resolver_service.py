"""
RESOLVER SERVICE - Traduce input utente in oggetti di dominio

Responsabilita:
- Risolve il nodo sorgente a partire da stringhe user-friendly
- Valida e normalizza l'IP di destinazione
- Fornisce errori chiari con suggerimenti utili
"""

from __future__ import annotations

from typing import Dict, List, Optional
import ipaddress

from application.models.topology import Node
from application.models.snapshot import NetworkSnapshot


class ResolverError(Exception):
    """Errore base del resolver con eventuali candidati."""

    def __init__(self, message: str, candidates: Optional[List[str]] = None) -> None:
        super().__init__(message)
        self.message = message
        self.candidates = candidates or []

    def __str__(self) -> str:
        return self.message


class InvalidSourceError(ResolverError):
    """Formato sorgente non valido."""
    pass


class NodeNotFoundError(ResolverError):
    """Nodo sorgente non trovato."""
    pass


class AmbiguousSourceError(ResolverError):
    """Sorgente ambigua: piu' VDOM possibili."""
    pass


class InvalidTargetError(ResolverError):
    """Destinazione IP non valida o non supportata."""
    pass


class ResolverService:
    """
    Resolver per l'input utente.

    - Accetta source come "device:vdom" o solo "device"
    - Se device ha un solo VDOM, lo usa
    - Se device ha piu' VDOM, prova default_vdom (es. root)
    - Altrimenti solleva AmbiguousSourceError
    """

    def __init__(self, default_vdom: str = "root") -> None:
        self.default_vdom = default_vdom

    def resolve_source(self, source_spec: str, snapshot: NetworkSnapshot) -> Node:
        """Risolve la sorgente in un Node valido."""
        if source_spec is None:
            raise InvalidSourceError("Sorgente mancante.")

        source_spec = source_spec.strip()
        if not source_spec:
            raise InvalidSourceError("Sorgente vuota.")

        nodes = snapshot.topology.nodes
        node_key_map, device_map = self._build_indexes(nodes)

        # Explicit device:vdom
        if ":" in source_spec:
            device_id, vdom = source_spec.split(":", 1)
            device_id = device_id.strip()
            vdom = vdom.strip()

            if not device_id or not vdom:
                raise InvalidSourceError(
                    "Formato sorgente non valido. Usa 'device:vdom'."
                )

            key = f"{device_id}:{vdom}"
            if key in nodes:
                return Node(device_id=device_id, vdom=vdom)

            # Case-insensitive match
            actual_key = node_key_map.get(key.lower())
            if actual_key:
                return self._node_from_key(actual_key)

            # Device exists but VDOM not found
            device_candidates = device_map.get(device_id.lower(), [])
            if device_candidates:
                raise NodeNotFoundError(
                    f"VDOM '{vdom}' non trovato per device '{device_id}'.",
                    candidates=sorted(device_candidates),
                )

            raise NodeNotFoundError(
                f"Nodo sorgente '{source_spec}' non trovato.",
                candidates=sorted(nodes),
            )

        # Device-only resolution
        device_candidates = device_map.get(source_spec.lower(), [])
        if not device_candidates:
            raise NodeNotFoundError(
                f"Device '{source_spec}' non trovato.",
                candidates=sorted(nodes),
            )

        if len(device_candidates) == 1:
            return self._node_from_key(device_candidates[0])

        # Prefer default VDOM (e.g. root)
        default_matches = [
            n for n in device_candidates
            if n.split(":", 1)[1].lower() == self.default_vdom.lower()
        ]
        if len(default_matches) == 1:
            return self._node_from_key(default_matches[0])

        raise AmbiguousSourceError(
            f"Device '{source_spec}' ha piu' VDOM. Specifica 'device:vdom'.",
            candidates=sorted(device_candidates),
        )

    def resolve_target_ip(self, target_spec: str) -> str:
        """Valida e normalizza l'IP di destinazione."""
        if target_spec is None:
            raise InvalidTargetError("Destinazione mancante.")

        target_spec = target_spec.strip()
        if not target_spec:
            raise InvalidTargetError("Destinazione vuota.")

        try:
            ip = ipaddress.ip_address(target_spec)
        except ValueError as exc:
            raise InvalidTargetError(
                f"IP destinazione non valido: '{target_spec}'."
            ) from exc

        if isinstance(ip, ipaddress.IPv6Address):
            raise InvalidTargetError("IPv6 non supportato in questa versione.")

        return str(ip)

    @staticmethod
    def _build_indexes(nodes: set[str]) -> tuple[Dict[str, str], Dict[str, List[str]]]:
        node_key_map: Dict[str, str] = {}
        device_map: Dict[str, List[str]] = {}

        for node_key in nodes:
            node_key_map[node_key.lower()] = node_key

            if ":" not in node_key:
                continue

            device_id, _ = node_key.split(":", 1)
            device_map.setdefault(device_id.lower(), []).append(node_key)

        return node_key_map, device_map

    @staticmethod
    def _node_from_key(node_key: str) -> Node:
        device_id, vdom = node_key.split(":", 1)
        return Node(device_id=device_id, vdom=vdom)
