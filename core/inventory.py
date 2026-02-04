import json
import sys
from typing import List
from domain.models import FirewallConfig

class InventoryLoader:
    """
    Responsabilità Unica: Caricare la configurazione dei firewall da disco.
    Non si connette, non scansiona. Legge e valida solo il JSON.
    """
    def __init__(self, file_path: str = "inventory.json"):
        self.file_path = file_path

    def load(self) -> List[FirewallConfig]:
        """
        Legge il file JSON e lo converte in una lista di oggetti FirewallConfig.
        Gestisce gli errori critici (file mancante, JSON rotto, campi mancanti).
        """
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            configs = []
            for item in data:
                # Qui avviene la magia di Pydantic:
                # Se nel JSON hai scritto "host" ma mancava "token", 
                # questa riga esplode e ti dice esattamente cosa manca.
                config = FirewallConfig(**item)
                configs.append(config)
            
            return configs

        except FileNotFoundError:
            print(f"\n❌ ERRORE CRITICO: Il file '{self.file_path}' non esiste.")
            print("   Crea il file nella cartella principale prima di continuare.")
            sys.exit(1)
            
        except json.JSONDecodeError:
            print(f"\n❌ ERRORE FORMATO: Il file '{self.file_path}' contiene errori di sintassi (virgole, parentesi).")
            sys.exit(1)
            
        except Exception as e:
            # Cattura anche gli errori di validazione di Pydantic (es. manca campo obbligatorio)
            print(f"\n❌ ERRORE CONFIGURAZIONE: {e}")
            sys.exit(1)