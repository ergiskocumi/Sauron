import requests
import urllib3
from typing import List, Dict, Any, Optional
from pydantic import ValidationError

# Importiamo il Contratto (Port) e le Entità (Domain)
from domain.ports import FirewallRepository
from domain.models import Route, NetworkInterface

# Disabilitiamo i warning per i certificati SSL self-signed (tipico nelle intranet)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class FortiGateClient(FirewallRepository):
    """
    Adapter concreto che implementa la comunicazione con FortiOS via REST API.
    Trasforma i JSON grezzi ("sporchi") in oggetti di Dominio puliti.
    """

    def __init__(self, ip_address: str, api_token: str):
        """
        Inizializza la sessione HTTP.
        """
        self.base_url = f"https://{ip_address}/api/v2"
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json'
        }
        
        # Ottimizzazione: Usiamo una Session per riutilizzare la connessione TCP (Keep-Alive)
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        self.session.verify = False # In produzione, punta al file .pem della CA aziendale

    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Metodo helper privato per gestire le chiamate HTTP, gli errori e l'estrazione dei risultati.
        Rispetta il principio DRY (Don't Repeat Yourself).
        """
        full_url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.get(full_url, params=params, timeout=10)
            response.raise_for_status() # Solleva eccezione se status code è 4xx o 5xx
            
            data = response.json()
            
            # Pattern Matching: Fortigate restituisce i dati o in 'results' (lista) o direttamente
            if 'results' in data:
                # Se 'results' è un dizionario (es. monitor interfaces), lo convertiamo in lista
                if isinstance(data['results'], dict):
                    return list(data['results'].values())
                return data['results']
            
            return []

        except requests.exceptions.RequestException as e:
            print(f"[ERRORE DI RETE] Impossibile contattare {full_url}: {e}")
            return []
        except ValueError:
            print(f"[ERRORE JSON] Risposta non valida dal firewall.")
            return []

    # --- IMPLEMENTAZIONE DEL CONTRATTO (Ports) ---

    def get_routing_table(self) -> List[Route]:
        """
        Scarica la Routing Table attiva e la converte in oggetti Route.
        """
        endpoint = "/monitor/router/ipv4"
        raw_data = self._make_request(endpoint)
        
        clean_routes = []
        for item in raw_data:
            try:
                # La magia di Pydantic: disimballiamo il dizionario (**item)
                # Il modello cercherà i campi usando gli 'alias' definiti (es. ip_mask -> destination)
                route = Route(**item)
                clean_routes.append(route)
            except ValidationError as e:
                # Logghiamo l'errore ma non blocchiamo tutto il processo per una sola rotta corrotta
                print(f"[WARN] Impossibile parsare la rotta verso {item.get('ip_mask', 'unknown')}: {e}")
        
        return clean_routes

    def get_interfaces(self, vdom: str = "root", type_filter: Optional[str] = None) -> List[NetworkInterface]:
        """
        Scarica le interfacce dal CMDB, applicando filtri VDOM e Tipo.
        """
        endpoint = "/cmdb/system/interface"
        
        # Costruiamo i parametri per la query string
        params = {'vdom': vdom}
        
        # Applicazione del filtro server-side (Ottimizzazione: scarichiamo meno dati)
        if type_filter:
            params['filter'] = f"type=={type_filter}"

        raw_data = self._make_request(endpoint, params=params)
        
        clean_interfaces = []
        for item in raw_data:
            try:
                # Pydantic pulirà l'IP (split con mask), convertirà lo status in bool, ecc.
                # Nota: item.get('interface') verrà mappato su parent_interface grazie all'alias nel Model
                interface = NetworkInterface(**item)
                clean_interfaces.append(interface)
            except ValidationError as e:
                # Utile per debuggare se il firewall manda dati strani
                print(f"[WARN] Impossibile parsare l'interfaccia {item.get('name', 'unknown')}: {e}")
        
        return clean_interfaces