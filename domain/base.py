"""
SAURON BASE MODEL - Configurazione Pydantic condivisa

Classe base per tutti i modelli di dominio.
Evita duplicazione di model_config in ogni modello.
"""

from pydantic import BaseModel


class SauronBaseModel(BaseModel):
    """Base model con configurazione comune a tutti i modelli Sauron."""

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }
