"""
APPLICATION MODELS - DTOs per Topology, Pathfinding e Snapshot

Modelli Pydantic per:
- Topology: Node, InterfaceRecord, Link, Topology
- Pathfinding: PathStatus, HopResult, PathResult
- Snapshot: NetworkSnapshot, FirewallMetadata
"""

from application.models.topology import Node, InterfaceRecord, Link, Topology
from application.models.pathfinder import PathStatus, HopResult, PathResult
from application.models.snapshot import NetworkSnapshot, FirewallMetadata

__all__ = [
    # Topology
    "Node",
    "InterfaceRecord",
    "Link",
    "Topology",
    # Pathfinding
    "PathStatus",
    "HopResult",
    "PathResult",
    # Snapshot
    "NetworkSnapshot",
    "FirewallMetadata",
]
