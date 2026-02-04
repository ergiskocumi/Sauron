"""
APPLICATION LAYER - Use Cases e Business Logic

Questo layer contiene:
- Models: DTOs per topology e pathfinding
- Services: Logica di business per costruzione grafi e simulazione percorsi

Architettura:
    Domain (models.py) -> Application (services) -> Infrastructure (clients)
"""

from application.models.topology import Node, InterfaceRecord, Link, Topology
from application.models.pathfinder import PathStatus, HopResult, PathResult
from application.services.topology_service import TopologyService
from application.services.pathfinder_service import PathfinderService
from application.services.resolver_service import ResolverService
from application.presenters.console_presenter import ConsolePresenter
from application.presenters.graphviz_presenter import GraphvizPresenter

__all__ = [
    # Topology Models
    "Node",
    "InterfaceRecord",
    "Link",
    "Topology",
    # Pathfinder Models
    "PathStatus",
    "HopResult",
    "PathResult",
    # Services
    "TopologyService",
    "PathfinderService",
    "ResolverService",
    # Presenters
    "ConsolePresenter",
    "GraphvizPresenter",
]
