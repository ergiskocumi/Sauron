"""
CONFIGURATION - Application Settings

Gestione centralizzata della configurazione tramite pydantic-settings.
Legge automaticamente da file .env e variabili d'ambiente.

Uso:
    from core.config import get_settings
    settings = get_settings()
"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """
    Configurazione dell'applicazione.

    Le variabili vengono lette da:
    1. Variabili d'ambiente (priorità massima)
    2. File .env nella root del progetto
    3. Valori di default definiti qui

    Nota: I nomi dei campi sono case-insensitive per il matching con env vars.
    """

    # --- Application Info ---
    app_name: str = Field(
        default="SAURON",
        description="Nome dell'applicazione"
    )
    app_version: str = Field(
        default="0.1.0",
        description="Versione dell'applicazione"
    )
    api_version: str = Field(
        default="v1",
        description="Versione dell'API REST"
    )
    debug: bool = Field(
        default=False,
        description="Abilita modalità debug con logging verboso"
    )

    # --- FortiGate Connection (Legacy single-firewall mode) ---
    fortigate_ip: Optional[str] = Field(
        default=None,
        description="IP:Porta del firewall (es. '10.0.0.1:10443')"
    )
    fortigate_api_token: Optional[str] = Field(
        default=None,
        description="API Token per autenticazione"
    )
    default_vdom: str = Field(
        default="root",
        description="VDOM di default per le query"
    )

    # --- HTTP Client Settings ---
    api_timeout: int = Field(
        default=30,
        ge=5,
        le=120,
        description="Timeout per le richieste HTTP in secondi"
    )
    ssl_verify: bool = Field(
        default=False,
        description="Verifica certificati SSL (False per self-signed)"
    )
    max_connections: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Numero massimo di connessioni nel pool HTTP"
    )
    max_retries: int = Field(
        default=3,
        ge=0,
        le=10,
        description="Numero di retry per richieste fallite"
    )

    # --- Inventory Settings ---
    inventory_file: str = Field(
        default="inventory.json",
        description="Path del file inventory dei firewall"
    )

    # --- Scan Settings ---
    parallel_scans: bool = Field(
        default=True,
        description="Scansiona i firewall in parallelo"
    )
    max_parallel_firewalls: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Numero massimo di firewall scansionati in parallelo"
    )

    # --- CORS Settings ---
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
        description="Lista di origini consentite per CORS"
    )

    # --- Logging Settings ---
    log_level: str = Field(
        default="INFO",
        description="Livello di logging (DEBUG, INFO, WARNING, ERROR)"
    )
    log_format: str = Field(
        default="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        description="Formato dei log"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignora variabili env non definite qui
    )


@lru_cache
def get_settings() -> Settings:
    """
    Factory function per ottenere le settings (singleton cached).

    Uso:
        settings = get_settings()
        print(settings.api_timeout)

    Note:
        - Il risultato è cached: modifiche a .env richiedono restart
        - Per test, usa `get_settings.cache_clear()` prima di mockare
    """
    return Settings()


# Backward compatibility: istanza globale deprecata
# Preferire sempre get_settings() per testabilità
settings = get_settings()
