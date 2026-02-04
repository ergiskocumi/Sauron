"""
Core Layer - Configuration and Infrastructure Setup

Questo package contiene:
- config: Gestione configurazione tramite pydantic-settings
- inventory: Loader per file inventory dei firewall
"""

from core.config import Settings, get_settings
from core.inventory import InventoryLoader, InventoryError

__all__ = [
    "Settings",
    "get_settings",
    "InventoryLoader",
    "InventoryError",
]
