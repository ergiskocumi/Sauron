import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Gestisce la configurazione dell'applicazione.
    Legge automaticamente le variabili dal file .env
    """
    # Application info
    app_version: str = os.getenv("APP_VERSION")  # Versione dell'applicazione
    api_version: str = os.getenv("API_VERSION")  # Versione dell'API
    # I nomi devono coincidere con quelli nel file .env (case-insensitive)
    fortigate_ip: str
    fortigate_api_token: str
    default_vdom: str = "root" # Valore di default se manca nel .env
    api_timeout: int = 10

    class Config:
        # Indica dove cercare il file env
        env_file = ".env"
        env_file_encoding = 'utf-8'

# Creiamo un'istanza globale da importare nel resto del programma
settings = Settings()