"""
INVENTORY LOADER - Configuration Layer

Carica e valida la configurazione dei firewall da file JSON.
Responsabilità singola: lettura e validazione dell'inventario.
"""

import json
import logging
from pathlib import Path
from typing import List

from pydantic import ValidationError

from domain.models import FirewallConfig


logger = logging.getLogger(__name__)


class InventoryError(Exception):
    """Eccezione per errori di caricamento inventario."""
    pass


class InventoryLoader:
    """
    Carica la configurazione dei firewall da file JSON.

    Responsabilità:
    - Leggere il file JSON
    - Validare la struttura con Pydantic
    - Restituire una lista di FirewallConfig

    Non si connette, non scansiona. Solo I/O e validazione.
    """

    def __init__(self, file_path: str = "inventory.json"):
        """
        Inizializza il loader.

        Args:
            file_path: Path del file inventory (relativo o assoluto)
        """
        self.file_path = Path(file_path)

    def load(self) -> List[FirewallConfig]:
        """
        Carica e valida l'inventario dei firewall.

        Returns:
            Lista di FirewallConfig validate

        Raises:
            InventoryError: Se il file non esiste, ha errori di sintassi,
                           o contiene dati non validi
        """
        logger.info(f"Loading inventory from: {self.file_path}")

        # Verifica esistenza file
        if not self.file_path.exists():
            self._handle_error(
                f"Il file inventario '{self.file_path}' non esiste.",
                hint="Crea il file nella cartella principale con la lista dei firewall."
            )

        # Lettura file
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
        except json.JSONDecodeError as e:
            self._handle_error(
                f"Errore di sintassi JSON nel file '{self.file_path}'",
                hint=f"Riga {e.lineno}, colonna {e.colno}: {e.msg}"
            )
        except PermissionError:
            self._handle_error(
                f"Permessi insufficienti per leggere '{self.file_path}'"
            )
        except Exception as e:
            self._handle_error(f"Errore lettura file: {e}")

        # Validazione struttura
        if not isinstance(raw_data, list):
            self._handle_error(
                "L'inventario deve essere un array JSON di firewall",
                hint="Formato atteso: [{\"id\": \"...\", \"host\": \"...\", \"token\": \"...\"}, ...]"
            )

        if len(raw_data) == 0:
            self._handle_error(
                "L'inventario è vuoto",
                hint="Aggiungi almeno un firewall al file inventory.json"
            )

        # Validazione singoli firewall
        configs: List[FirewallConfig] = []
        errors: List[str] = []

        for idx, item in enumerate(raw_data):
            try:
                config = FirewallConfig.model_validate(item)
                configs.append(config)
                logger.debug(f"Loaded firewall: {config.id}")
            except ValidationError as e:
                fw_id = item.get("id", f"firewall #{idx + 1}")
                for error in e.errors():
                    field = ".".join(str(loc) for loc in error["loc"])
                    errors.append(f"  - {fw_id}: campo '{field}' - {error['msg']}")

        if errors:
            error_list = "\n".join(errors)
            self._handle_error(
                f"Errori di validazione nell'inventario:\n{error_list}"
            )

        logger.info(f"Loaded {len(configs)} firewall configurations")

        # Log summary
        enabled = sum(1 for c in configs if c.enabled)
        disabled = len(configs) - enabled

        if disabled > 0:
            logger.info(f"  - Enabled: {enabled}, Disabled: {disabled}")

        return configs

    def _handle_error(self, message: str, hint: str = None) -> None:
        """
        Gestisce un errore critico lanciando InventoryError.
        """
        full_message = message
        if hint:
            full_message += f" (Suggerimento: {hint})"

        logger.error(message)
        raise InventoryError(full_message)

    def add_firewall(self, new_fw: dict) -> dict:
        """
        Aggiunge un firewall all'inventario con controlli duplicati.

        Args:
            new_fw: dict con campi 'id', 'host', 'token'

        Returns:
            dict del firewall aggiunto

        Raises:
            InventoryError: Se id o host sono duplicati, o dati non validi
        """
        # Leggi inventario corrente (o lista vuota se file non esiste)
        if self.file_path.exists():
            with open(self.file_path, "r", encoding="utf-8") as f:
                raw_data = json.load(f)
        else:
            raw_data = []

        # Validazione campi obbligatori
        fw_id = (new_fw.get("id") or "").strip()
        fw_host = (new_fw.get("host") or "").strip()
        fw_token = (new_fw.get("token") or "").strip()

        if not fw_id:
            raise InventoryError("Il campo 'id' (nome firewall) è obbligatorio.")
        if not fw_host:
            raise InventoryError("Il campo 'host' (IP:porta) è obbligatorio.")
        if not fw_token:
            raise InventoryError("Il campo 'token' è obbligatorio.")

        # Validazione formato host (deve avere IP:porta)
        if ":" not in fw_host:
            raise InventoryError("Host deve includere la porta (es. '10.0.0.1:443').")
        host_ip = fw_host.rsplit(":", 1)[0]
        port_str = fw_host.rsplit(":", 1)[1]
        if not port_str.isdigit():
            raise InventoryError(f"Porta non valida: {port_str}")

        # Check duplicato nome (case-insensitive)
        for existing in raw_data:
            if existing.get("id", "").strip().lower() == fw_id.lower():
                raise InventoryError(
                    f"Esiste già un firewall con il nome '{existing['id']}'."
                )

        # Check duplicato host/IP (confronta solo la parte IP, ignora porta)
        for existing in raw_data:
            existing_ip = existing.get("host", "").rsplit(":", 1)[0]
            if existing_ip == host_ip:
                raise InventoryError(
                    f"Esiste già un firewall con lo stesso IP: '{existing['host']}' ({existing['id']})."
                )

        # Costruisci entry e validala con Pydantic
        entry = {
            "id": fw_id,
            "host": fw_host,
            "token": fw_token,
        }

        from domain.models import FirewallConfig
        try:
            FirewallConfig.model_validate(entry)
        except Exception as e:
            raise InventoryError(f"Dati non validi: {e}")

        # Salva
        raw_data.append(entry)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(raw_data, f, indent=2, ensure_ascii=False)

        logger.info(f"Firewall aggiunto: {fw_id} ({fw_host})")
        return entry

    def validate_file(self) -> bool:
        """
        Verifica che il file inventario sia valido senza caricarlo.

        Returns:
            True se valido, False altrimenti
        """
        try:
            configs = self.load()
            return len(configs) > 0
        except InventoryError:
            return False
