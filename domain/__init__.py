"""
Domain Layer - Business Logic and Entities

Questo package contiene:
- models: Entità Pydantic del dominio (Route, NetworkInterface, Vdom, etc.)
- ports: Interfacce astratte (contratti) per il repository pattern
"""

from domain.models import (
    Route,
    NetworkInterface,
    Vdom,
    FirewallConfig,
    ScanResult,
)
from domain.ports import (
    FirewallRepository,
    FirewallRepositoryError,
    ConnectionError,
    AuthenticationError,
    VdomNotFoundError,
)

__all__ = [
    # Models
    "Route",
    "NetworkInterface",
    "Vdom",
    "FirewallConfig",
    "ScanResult",
    # Ports
    "FirewallRepository",
    "FirewallRepositoryError",
    "ConnectionError",
    "AuthenticationError",
    "VdomNotFoundError",
]
