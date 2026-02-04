"""
DOMAIN MODELS - Entità di Business

Modelli Pydantic V2 che rappresentano le entità del dominio.
Validazione automatica, serializzazione e type safety.

Nota: Usare field_validator e model_validator (Pydantic V2 syntax).
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Any
from datetime import datetime


class Route(BaseModel):
    """
    Rappresenta una voce nella Routing Information Base (RIB) del firewall.
    Mappato dall'endpoint /monitor/router/ipv4
    """

    destination: str = Field(
        ...,
        alias="ip_mask",
        description="Network di destinazione in CIDR (es. 0.0.0.0/0)"
    )
    gateway: str = Field(
        ...,
        description="Next-hop IP address"
    )
    interface: str = Field(
        ...,
        description="Interfaccia di uscita"
    )
    protocol: str = Field(
        ...,
        alias="type",
        description="Protocollo (ospf, static, bgp, connected)"
    )
    subtype: Optional[str] = Field(
        None,
        description="Sottotipo protocollo (es. external_2 per OSPF)"
    )
    distance: int = Field(
        ...,
        description="Administrative Distance"
    )
    metric: int = Field(
        ...,
        description="Costo/metrica del percorso"
    )
    priority: int = Field(
        1,
        description="Priorità della rotta"
    )
    vrf: int = Field(
        0,
        description="ID della VRF (0 = Global)"
    )
    install_date: Optional[int] = Field(
        None,
        description="Unix timestamp di installazione"
    )

    @property
    def is_default_route(self) -> bool:
        """Verifica se è una default route (0.0.0.0/0)."""
        return self.destination.startswith("0.0.0.0")

    @property
    def install_datetime(self) -> Optional[datetime]:
        """Converte il timestamp in datetime."""
        if self.install_date:
            return datetime.fromtimestamp(self.install_date)
        return None

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


class NetworkInterface(BaseModel):
    """
    Rappresenta la configurazione e lo stato di un'interfaccia di rete.
    Mappato dall'endpoint /cmdb/system/interface
    """

    name: str = Field(
        ...,
        description="Nome tecnico (es. VLAN10, port1)"
    )
    alias: Optional[str] = Field(
        None,
        description="Alias leggibile/Descrizione"
    )
    vdom: str = Field(
        ...,
        description="Virtual Domain di appartenenza"
    )
    type: str = Field(
        ...,
        description="Tipo interfaccia (vlan, physical, tunnel, hard-switch)"
    )
    mode: str = Field(
        ...,
        description="Modalità indirizzamento (static, dhcp, pppoe)"
    )
    mtu: int = Field(
        1500,
        description="Maximum Transmission Unit"
    )
    parent_interface: Optional[str] = Field(
        None,
        alias="interface",
        description="Interfaccia fisica padre (solo per VLAN)"
    )
    vlan_id: Optional[int] = Field(
        None,
        alias="vlanid",
        description="ID della VLAN (tag 802.1Q)"
    )
    ip: str = Field(
        ...,
        description="Indirizzo IP (senza mask)"
    )
    mask: Optional[str] = Field(
        None,
        description="Subnet Mask"
    )
    is_up: bool = Field(
        ...,
        alias="status",
        description="Stato operativo"
    )
    allow_access: Optional[str] = Field(
        None,
        alias="allowaccess",
        description="Protocolli ammessi (es. ping https ssh)"
    )

    @field_validator("is_up", mode="before")
    @classmethod
    def parse_status(cls, v: Any) -> bool:
        """Trasforma 'up'/'down' in booleano."""
        if isinstance(v, str):
            return v.lower() == "up"
        return bool(v)

    @model_validator(mode="before")
    @classmethod
    def split_ip_and_mask(cls, data: Any) -> Any:
        """
        Splitta 'ip' dal formato FortiGate '172.26.26.1 255.255.255.0'
        in due campi separati: ip e mask.
        """
        if isinstance(data, dict):
            ip_value = data.get("ip", "")
            if isinstance(ip_value, str) and " " in ip_value:
                parts = ip_value.split(" ", 1)
                data["ip"] = parts[0]
                data["mask"] = parts[1] if len(parts) > 1 else None
        return data

    @property
    def cidr(self) -> Optional[str]:
        """Restituisce l'indirizzo in notazione CIDR se mask presente."""
        if self.mask:
            prefix = self._mask_to_prefix(self.mask)
            return f"{self.ip}/{prefix}"
        return self.ip

    @staticmethod
    def _mask_to_prefix(mask: str) -> int:
        """Converte subnet mask in prefix length (es. 255.255.255.0 -> 24)."""
        try:
            octets = [int(x) for x in mask.split(".")]
            binary = "".join(format(octet, "08b") for octet in octets)
            return binary.count("1")
        except (ValueError, AttributeError):
            return 0

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


class Vdom(BaseModel):
    """
    Rappresenta un Virtual Domain (VDOM) nel FortiGate.
    Mappato dall'endpoint /cmdb/system/vdom
    """

    name: str = Field(
        ...,
        description="Nome del VDOM"
    )
    short_name: str = Field(
        ...,
        alias="short-name",
        description="Nome breve per visualizzazione"
    )

    @property
    def is_root(self) -> bool:
        """Verifica se è il VDOM root."""
        return self.name.lower() == "root"

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


class FirewallConfig(BaseModel):
    """
    Configurazione di connessione a un singolo Firewall.
    Caricato dal file inventory.json.
    """

    id: str = Field(
        ...,
        description="ID univoco mnemonico (es. 'fw-milano')"
    )
    host: str = Field(
        ...,
        description="IP:Porta (es. '10.101.201.1:10443')"
    )
    token: str = Field(
        ...,
        description="API Token per autenticazione"
    )
    entry_vdom: str = Field(
        "root",
        description="VDOM di gestione per accesso iniziale"
    )
    enabled: bool = Field(
        True,
        description="Se False, il firewall viene saltato nella scansione"
    )

    @field_validator("host")
    @classmethod
    def validate_host_format(cls, v: str) -> str:
        """Valida formato host:port."""
        if ":" not in v:
            raise ValueError("Host deve includere la porta (es. '10.0.0.1:443')")
        host, port = v.rsplit(":", 1)
        if not port.isdigit():
            raise ValueError(f"Porta non valida: {port}")
        return v

    model_config = {
        "populate_by_name": True,
        "str_strip_whitespace": True,
    }


class ScanResult(BaseModel):
    """
    Risultato della scansione di un singolo firewall.
    Utile per aggregare e serializzare i risultati.
    """

    firewall_id: str
    firewall_host: str
    success: bool
    error_message: Optional[str] = None
    vdoms_count: int = 0
    routes_count: int = 0
    interfaces_count: int = 0
    scan_duration_ms: Optional[float] = None

    model_config = {
        "str_strip_whitespace": True,
    }
