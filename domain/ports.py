"""
PORTS - Clean Architecture Interfaces

Questo modulo definisce i contratti (Port/Interface) che il layer Infrastructure
deve implementare. Il Domain Layer usa solo queste interfacce astratte,
permettendo di sostituire l'implementazione (es. mock per test, altro vendor).

Principi rispettati:
- Dependency Inversion Principle (DIP): Il domain dipende da astrazioni
- Interface Segregation Principle (ISP): Interfacce specifiche per ruolo
- Liskov Substitution Principle (LSP): Le implementazioni sono intercambiabili
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from domain.models import Route, NetworkInterface, Vdom


class FirewallRepository(ABC):
    """
    Contratto per l'accesso ai dati di un Firewall.

    Tutte le implementazioni concrete (FortiGate, PaloAlto, mock)
    DEVONO rispettare questa interfaccia esattamente.
    """

    @abstractmethod
    async def get_routing_table(self, vdom: str = "root") -> List[Route]:
        """
        Recupera la tabella di routing (RIB) per uno specifico VDOM.

        Args:
            vdom: Il Virtual Domain da interrogare. Default "root".

        Returns:
            Lista di Route validate. Lista vuota se nessuna rotta trovata.

        Raises:
            ConnectionError: Se il firewall non è raggiungibile.
            AuthenticationError: Se il token API non è valido.
        """
        ...

    @abstractmethod
    async def get_interfaces(
        self,
        vdom: str = "root",
        type_filter: Optional[str] = None
    ) -> List[NetworkInterface]:
        """
        Recupera le interfacce di rete per un dato VDOM.

        Args:
            vdom: Il Virtual Domain da interrogare. Default "root".
            type_filter: Filtra per tipo (es. 'vlan', 'physical', 'tunnel').
                        Se None, restituisce tutte le interfacce.

        Returns:
            Lista di NetworkInterface validate.
        """
        ...

    @abstractmethod
    async def get_vdoms(self) -> List[Vdom]:
        """
        Recupera la lista di tutti i Virtual Domain configurati.

        Nota: Richiede permessi di lettura sul VDOM root per vedere
        la lista globale dei VDOM.

        Returns:
            Lista di Vdom. Conterrà sempre almeno "root".
        """
        ...

    # --- LIFECYCLE METHODS ---

    @abstractmethod
    async def connect(self) -> None:
        """
        Inizializza la connessione al firewall.

        Deve essere chiamato prima di usare altri metodi.
        Implementa connection pooling dove possibile.
        """
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """
        Chiude la connessione e rilascia le risorse.

        Deve essere chiamato alla fine dell'utilizzo per evitare
        resource leak.
        """
        ...

    # --- CONTEXT MANAGER SUPPORT ---

    async def __aenter__(self) -> "FirewallRepository":
        """Supporto per 'async with' - chiama connect()."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Supporto per 'async with' - chiama disconnect()."""
        await self.disconnect()


class FirewallRepositoryError(Exception):
    """Eccezione base per errori del repository."""
    pass


class ConnectionError(FirewallRepositoryError):
    """Errore di connessione al firewall."""
    pass


class AuthenticationError(FirewallRepositoryError):
    """Errore di autenticazione (token invalido/scaduto)."""
    pass


class VdomNotFoundError(FirewallRepositoryError):
    """Il VDOM richiesto non esiste."""
    pass
