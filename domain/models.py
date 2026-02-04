from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime

class Route(BaseModel):
    """
    Rappresenta una voce nella Routing Information Base (RIB) del firewall.
    Basato sull'endpoint /monitor/router/ipv4
    """
    # Identificazione
    destination: str = Field(..., alias="ip_mask", description="Network di destinazione (es. 0.0.0.0/0)")
    gateway: str = Field(..., description="Il next-hop IP")
    interface: str = Field(..., description="Interfaccia di uscita")
    
    # Dettagli Protocollo
    protocol: str = Field(..., alias="type", description="Protocollo (ospf, static, bgp, connected)")
    subtype: Optional[str] = Field(None, description="Sottotipo protocollo (es. external_2 per OSPF)")
    
    # Metriche decisionali
    distance: int = Field(..., description="Administrative Distance")
    metric: int = Field(..., description="Costo del percorso")
    priority: int = Field(1, description="Priorità della rotta")
    
    # Contesto di rete
    vrf: int = Field(0, description="ID della VRF (0 = Global)")
    
    # Monitoring
    install_date: Optional[int] = Field(None, description="Unix timestamp di installazione")

    # --- Computed Properties (Opzionale, per comodità nel backend) ---
    @property
    def is_default_route(self) -> bool:
        return self.destination.startswith("0.0.0.0")

    # Se install_date è None, non possiamo convertirlo in data
    @property
    def install_datetime(self) -> Optional[datetime]:
        if self.install_date:
            return datetime.fromtimestamp(self.install_date)
        return None

    class Config:
        # Permette di usare sia route.ip_mask che route.destination
        populate_by_name = True
        
        

# --- ENTITÀ 2: INTERFACCIA (Nuova e Dettagliata) ---
class NetworkInterface(BaseModel):
    """
    Rappresenta la configurazione e lo stato di un'interfaccia.
    Basato sull'endpoint /cmdb/system/interface
    """
    
    # 1. Identificazione Base
    name: str = Field(..., description="Nome tecnico (es. ALLARME, port1)")
    alias: Optional[str] = Field(None, description="Alias leggibile/Descrizione")
    vdom: str = Field(..., description="Virtual Domain di appartenenza")
    
    # 2. Configurazione Fisica/Logica
    type: str = Field(..., description="Tipo interfaccia (vlan, physical, tunnel, hard-switch)")
    mode: str = Field(..., description="Modalità indirizzamento (static, dhcp, pppoe)")
    mtu: int = Field(1500, description="Maximum Transmission Unit")
    
    # 3. Relazioni (Fondamentale per le VLAN)
    # Nel JSON si chiama "interface", ma noi lo rinominiamo "parent_interface" per chiarezza
    parent_interface: Optional[str] = Field(None, alias="interface", description="Interfaccia fisica padre (solo per VLAN)")
    vlan_id: Optional[int] = Field(None, alias="vlanid", description="ID della VLAN (tag 802.1Q)")
    
    # 4. Indirizzamento (Gestito dai validator sotto)
    ip: str = Field(..., description="Indirizzo IP pulito (senza mask)")
    mask: Optional[str] = Field(None, description="Subnet Mask estratta")
    
    # 5. Stato e Sicurezza
    # Nel JSON è "status": "up", noi lo trasformiamo in booleano
    is_up: bool = Field(..., alias="status", description="Stato amministrativo")
    allow_access: Optional[str] = Field(None, alias="allowaccess", description="Protocolli ammessi (es. ping https ssh)")

    # --- VALIDATORS (La logica di pulizia dati) ---

    @validator('is_up', pre=True)
    def parse_status(cls, v):
        """Trasforma la stringa 'up'/'down' in True/False"""
        if isinstance(v, str):
            return v.lower() == "up"
        return bool(v)

    @validator('ip', pre=True)
    def split_ip_mask(cls, v, values):
        """
        Il Fortigate restituisce: '172.26.26.1 255.255.255.0'
        Questo validator spezza la stringa:
        - Ritorna '172.26.26.1' al campo `ip`
        - Inserisce '255.255.255.0' nel campo `mask` (che è opzionale)
        """
        if isinstance(v, str) and " " in v:
            parts = v.split(" ")
            # Salviamo la seconda parte (la mask) nel dizionario dei valori
            values['mask'] = parts[1]
            # Ritorniamo la prima parte (l'IP) come valore di questo campo
            return parts[0]
        return v

    class Config:
        # Questo permette di creare l'oggetto sia usando i nomi JSON (alias) 
        # sia i nomi Python (es. parent_interface)
        populate_by_name = True     
        
# quelli che hanno un alias è fatto a posta per chè pydantic può andare a leggere direttamente da json con quei nomi
# però io leggo DESTINATION ad esempio che è più comodo per un essere umano