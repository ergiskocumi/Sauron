from abc import ABC, abstractmethod
from typing import List, Optional
from domain.models import Route, NetworkInterface, Vdom

class FirewallRepository(ABC):
    """
    PORTA (Port) - Clean Architecture.
    
    Questa classe astratta definisce il 'Contratto' che il layer Infrastructure
    deve rispettare. Il Domain Layer (la logica di business) userà solo questa
    classe e non saprà mai se sotto c'è un Fortigate reale o un file di test.
    """

    @abstractmethod
    def get_routing_table(self) -> List[Route]:
        """
        Recupera l'intera tabella di routing attiva (RIB).
        Le implementazioni concrete dovrebbero interrogare l'endpoint di Monitor.
        
        Returns:
            List[Route]: Lista di oggetti Route validati e puliti.
        """
        pass

    @abstractmethod
    def get_interfaces(self, vdom: str = "root", type_filter: Optional[str] = None) -> List[NetworkInterface]:
        """
        Recupera la configurazione delle interfacce per un dato VDOM.
        
        Args:
            vdom (str): Il Virtual Domain da interrogare (default: 'root').
            type_filter (Optional[str]): Se specificato, filtra per tipo (es. 'vlan', 'physical').
                                         Se None, restituisce tutte le interfacce.

        Returns:
            List[NetworkInterface]: Lista di oggetti NetworkInterface con IP e maschere separate.
        """
        pass
    
    @abstractmethod
    def get_vdoms(self)-> List[Vdom]:
        """
        Recupera la lista dei VDOM configurati sul firewall.
        
        Returns:
            List[Vdom]: Lista di oggetti Vdom.
        """
        pass