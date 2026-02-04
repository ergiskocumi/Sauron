import httpx
from typing import List, Dict, Any, Optional
from pydantic import ValidationError

# Importiamo il Contratto (Port) e le Entità (Domain)
from domain.ports import FirewallRepository
from domain.models import Route, NetworkInterface, Vdom

class FortiGateClient(FirewallRepository):
    """
    Adapter ASINCRONO che implementa la comunicazione con FortiOS via REST API.
    Usa httpx per non bloccare l'esecuzione durante l'attesa della rete.
    """

    def __init__(self, ip_address: str, api_token: str):
        """
        Configurazione base. Non apriamo sessioni qui, usiamo il context manager
        per ogni richiesta (o gruppo di richieste) per sicurezza e pulizia.
        """
        self.base_url = f"https://{ip_address}/api/v2"
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json'
        }
        # Disabilitiamo la verifica SSL (equivalente a verify=False di requests)
        self.verify_ssl = False

    async def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Motore Asincrono: Gestisce la chiamata HTTP.
        """
        full_url = f"{self.base_url}{endpoint}"
        
        # httpx.AsyncClient è l'equivalente moderno di requests.Session
        async with httpx.AsyncClient(verify=self.verify_ssl, timeout=10.0) as client:
            try:
                # 'await' dice a Python: "Mentre aspetti la risposta del firewall,
                # vai pure avanti a fare altro (es. gestire un'altra richiesta)"
                response = await client.get(full_url, headers=self.headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                
                # Gestione standard del formato dati Fortigate
                if 'results' in data:
                    if isinstance(data['results'], dict):
                        return list(data['results'].values())
                    return data['results']
                
                return []

            except httpx.HTTPStatusError as e:
                print(f"[HTTP ERROR] {e.response.status_code} su {full_url}")
                return []
            except httpx.RequestError as e:
                print(f"[NET ERROR] Connessione fallita verso {full_url}: {e}")
                return []
            except Exception as e:
                print(f"[GENERIC ERROR] {e}")
                return []

    # --- IMPLEMENTAZIONE DEL CONTRATTO (Ports) ---
    # Nota: Tutti i metodi ora devono avere 'async def' e usare 'await'

    async def get_routing_table(self, vdom: str = "root") -> List[Route]:
        """
        Scarica la Routing Table per uno specifico VDOM.
        """
        endpoint = "/monitor/router/ipv4"
        
        # ORA usiamo il parametro vdom dinamico, non più fisso a 'root'
        raw_data = await self._make_request(endpoint, params={'vdom': vdom})
        
        clean_routes = []
        for item in raw_data:
            try:
                route = Route(**item)
                clean_routes.append(route)
            except ValidationError:
                pass 
        return clean_routes

    async def get_interfaces(self, vdom: str = "root", type_filter: Optional[str] = None) -> List[NetworkInterface]:
        """Scarica le interfacce (Asincrono) con FILTRO POST-PROCESSING."""
        endpoint = "/cmdb/system/interface"
        
        params = {'vdom': vdom} # Chiediamo al firewall di filtrare...
        if type_filter:
            params['filter'] = f"type=={type_filter}"

        raw_data = await self._make_request(endpoint, params=params)
        
        clean_interfaces = []
        for item in raw_data:
            try:
                # --- FIX: CONTROLLO DI SICUREZZA ---
                # A volte l'API Global restituisce tutto. Controlliamo il campo 'vdom'.
                # Se l'interfaccia dice di appartenere a "root", ma noi stiamo scansionando "ETIFOIL", la ignoriamo.
                item_vdom = item.get("vdom", "root")
                if item_vdom != vdom:
                    continue 
                # -----------------------------------

                interface = NetworkInterface(**item)
                clean_interfaces.append(interface)
            except ValidationError:
                pass
        return clean_interfaces

    async def get_vdoms(self) -> List[Vdom]:
        """Scarica la lista VDOM (Asincrono)."""
        endpoint = "/cmdb/system/vdom"
        raw_data = await self._make_request(endpoint, params={'vdom': 'root'})
        
        clean_vdoms = []
        for item in raw_data:
            try:
                vdom = Vdom(**item)
                clean_vdoms.append(vdom)
            except ValidationError:
                pass
        return clean_vdoms