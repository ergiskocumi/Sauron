"""
APPLICATION MODELS - DTOs per Topology e Pathfinding

Modelli Pydantic per:
- Topology: Node, InterfaceRecord, Link, Topology
- Pathfinding: PathStatus, HopResult, PathResult
"""

from application.models.topology import Node, InterfaceRecord, Link, Topology
from application.models.pathfinder import PathStatus, HopResult, PathResult

__all__ = [
    "Node",
    "InterfaceRecord",
    "Link",
    "Topology",
    "PathStatus",
    "HopResult",
    "PathResult",
]
