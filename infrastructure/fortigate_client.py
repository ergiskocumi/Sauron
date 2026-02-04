"""
FORTIGATE CLIENT - Infrastructure Layer

Implementazione asincrona del FirewallRepository per FortiOS REST API.
Usa httpx con connection pooling per alte prestazioni.

Features:
- Connection pooling (riuso connessioni HTTP)
- Retry automatico con backoff esponenziale
- Logging strutturato
- Context manager support (async with)
- Validazione dati con Pydantic
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional

import httpx
from pydantic import ValidationError

from domain.ports import (
    FirewallRepository,
    ConnectionError,
    AuthenticationError,
)
from domain.models import Route, NetworkInterface, Vdom
from core.config import get_settings


logger = logging.getLogger(__name__)


class FortiGateClient(FirewallRepository):
    """
    Client asincrono per FortiOS REST API.

    Uso raccomandato con context manager:
        async with FortiGateClient(ip, token) as client:
            routes = await client.get_routing_table()

    Oppure gestione manuale:
        client = FortiGateClient(ip, token)
        await client.connect()
        try:
            routes = await client.get_routing_table()
        finally:
            await client.disconnect()
    """

    def __init__(
        self,
        ip_address: str,
        api_token: str,
        timeout: Optional[int] = None,
        ssl_verify: Optional[bool] = None,
        max_retries: Optional[int] = None,
    ):
        """
        Inizializza il client FortiGate.

        Args:
            ip_address: IP:porta del firewall (es. "10.0.0.1:10443")
            api_token: Bearer token per autenticazione API
            timeout: Timeout richieste in secondi (default da settings)
            ssl_verify: Verifica certificati SSL (default da settings)
            max_retries: Numero di retry per errori transitori
        """
        settings = get_settings()

        self.base_url = f"https://{ip_address}/api/v2"
        self.ip_address = ip_address
        self._api_token = api_token  # Privato per non loggarlo accidentalmente

        self._timeout = timeout or settings.api_timeout
        self._ssl_verify = ssl_verify if ssl_verify is not None else settings.ssl_verify
        self._max_retries = max_retries if max_retries is not None else settings.max_retries
        self._max_connections = settings.max_connections

        self._client: Optional[httpx.AsyncClient] = None
        self._connected = False

        logger.debug(
            "FortiGateClient initialized",
            extra={"host": ip_address, "timeout": self._timeout}
        )

    @property
    def is_connected(self) -> bool:
        """Verifica se il client ha una connessione attiva."""
        return self._connected and self._client is not None

    async def connect(self) -> None:
        """
        Inizializza il client HTTP con connection pooling.

        Il client viene riusato per tutte le richieste, permettendo
        il riuso delle connessioni TCP (HTTP keep-alive).
        """
        if self._connected:
            logger.debug("Client already connected, skipping")
            return

        limits = httpx.Limits(
            max_connections=self._max_connections,
            max_keepalive_connections=self._max_connections // 2,
        )

        self._client = httpx.AsyncClient(
            verify=self._ssl_verify,
            timeout=httpx.Timeout(self._timeout),
            limits=limits,
            headers={
                "Authorization": f"Bearer {self._api_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        self._connected = True

        logger.info(f"Connected to FortiGate at {self.ip_address}")

    async def disconnect(self) -> None:
        """
        Chiude il client HTTP e rilascia le risorse.

        Importante chiamare questo metodo o usare il context manager
        per evitare resource leak.
        """
        if self._client:
            await self._client.aclose()
            self._client = None
            self._connected = False
            logger.info(f"Disconnected from FortiGate at {self.ip_address}")

    async def _ensure_connected(self) -> None:
        """Assicura che il client sia connesso, altrimenti connette."""
        if not self.is_connected:
            await self.connect()

    async def _make_request(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        method: str = "GET",
    ) -> List[Dict[str, Any]]:
        """
        Esegue una richiesta HTTP con retry e error handling.

        Args:
            endpoint: Path API (es. "/monitor/router/ipv4")
            params: Query parameters
            method: HTTP method (GET, POST, etc.)

        Returns:
            Lista di risultati dalla risposta API

        Raises:
            ConnectionError: Se il firewall non è raggiungibile
            AuthenticationError: Se il token non è valido
        """
        await self._ensure_connected()

        full_url = f"{self.base_url}{endpoint}"
        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries + 1):
            try:
                logger.debug(
                    f"API Request: {method} {endpoint}",
                    extra={"params": params, "attempt": attempt + 1}
                )

                response = await self._client.request(
                    method=method,
                    url=full_url,
                    params=params,
                )

                # Handle HTTP errors
                if response.status_code == 401:
                    raise AuthenticationError(
                        f"Token API non valido o scaduto per {self.ip_address}"
                    )

                if response.status_code == 403:
                    raise AuthenticationError(
                        f"Permessi insufficienti per {endpoint} su {self.ip_address}"
                    )

                response.raise_for_status()

                data = response.json()
                results = self._extract_results(data)

                logger.debug(
                    f"API Response: {len(results)} items from {endpoint}",
                    extra={"status": response.status_code}
                )

                return results

            except AuthenticationError:
                raise  # Non ritentare errori di autenticazione

            except httpx.ConnectError as e:
                last_error = ConnectionError(
                    f"Impossibile connettersi a {self.ip_address}: {e}"
                )
                logger.warning(
                    f"Connection failed (attempt {attempt + 1}/{self._max_retries + 1}): {e}"
                )

            except httpx.TimeoutException as e:
                last_error = ConnectionError(
                    f"Timeout connessione a {self.ip_address}: {e}"
                )
                logger.warning(
                    f"Timeout (attempt {attempt + 1}/{self._max_retries + 1}): {e}"
                )

            except httpx.HTTPStatusError as e:
                last_error = ConnectionError(
                    f"HTTP {e.response.status_code} da {self.ip_address}: {e}"
                )
                logger.warning(f"HTTP Error: {e.response.status_code}")

                # Non ritentare per errori 4xx (client errors)
                if 400 <= e.response.status_code < 500:
                    break

            except Exception as e:
                last_error = ConnectionError(f"Errore imprevisto: {e}")
                logger.exception(f"Unexpected error: {e}")

            # Backoff esponenziale tra i retry
            if attempt < self._max_retries:
                wait_time = 2 ** attempt  # 1s, 2s, 4s, ...
                logger.debug(f"Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)

        # Tutti i retry falliti
        if last_error:
            raise last_error

        return []

    @staticmethod
    def _extract_results(data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Estrae i risultati dalla risposta API FortiGate.

        Il formato può essere:
        - {"results": [...]}  -> Lista diretta
        - {"results": {"key": {...}, ...}} -> Dict da convertire in lista
        """
        if "results" not in data:
            return []

        results = data["results"]

        if isinstance(results, list):
            return results

        if isinstance(results, dict):
            return list(results.values())

        return []

    # --- IMPLEMENTAZIONE CONTRATTO FirewallRepository ---

    async def get_routing_table(self, vdom: str = "root") -> List[Route]:
        """
        Recupera la tabella di routing per uno specifico VDOM.

        Args:
            vdom: Virtual Domain da interrogare

        Returns:
            Lista di Route validate
        """
        endpoint = "/monitor/router/ipv4"
        raw_data = await self._make_request(endpoint, params={"vdom": vdom})

        routes: List[Route] = []
        validation_errors = 0

        for item in raw_data:
            try:
                route = Route.model_validate(item)
                routes.append(route)
            except ValidationError as e:
                validation_errors += 1
                logger.debug(f"Route validation failed: {e.error_count()} errors")

        if validation_errors > 0:
            logger.warning(
                f"Skipped {validation_errors} invalid routes from {self.ip_address}"
            )

        logger.info(
            f"Retrieved {len(routes)} routes from VDOM '{vdom}'",
            extra={"host": self.ip_address, "vdom": vdom}
        )

        return routes

    async def get_interfaces(
        self,
        vdom: str = "root",
        type_filter: Optional[str] = None,
    ) -> List[NetworkInterface]:
        """
        Recupera le interfacce di rete per un dato VDOM.

        Args:
            vdom: Virtual Domain da interrogare
            type_filter: Filtra per tipo (es. 'vlan', 'physical')

        Returns:
            Lista di NetworkInterface validate
        """
        endpoint = "/cmdb/system/interface"
        params: Dict[str, str] = {"vdom": vdom}

        if type_filter:
            params["filter"] = f"type=={type_filter}"

        raw_data = await self._make_request(endpoint, params=params)

        interfaces: List[NetworkInterface] = []
        validation_errors = 0
        vdom_mismatches = 0

        for item in raw_data:
            # Filtro post-processing per VDOM
            # L'API a volte restituisce interfacce di altri VDOM
            item_vdom = item.get("vdom", "root")
            if item_vdom != vdom:
                vdom_mismatches += 1
                continue

            try:
                interface = NetworkInterface.model_validate(item)
                interfaces.append(interface)
            except ValidationError as e:
                validation_errors += 1
                logger.debug(
                    f"Interface validation failed for '{item.get('name', '?')}': "
                    f"{e.error_count()} errors"
                )

        if validation_errors > 0:
            logger.warning(
                f"Skipped {validation_errors} invalid interfaces from {self.ip_address}"
            )

        if vdom_mismatches > 0:
            logger.debug(
                f"Filtered out {vdom_mismatches} interfaces from other VDOMs"
            )

        logger.info(
            f"Retrieved {len(interfaces)} interfaces from VDOM '{vdom}'",
            extra={"host": self.ip_address, "vdom": vdom, "type_filter": type_filter}
        )

        return interfaces

    async def get_vdoms(self) -> List[Vdom]:
        """
        Recupera la lista di tutti i Virtual Domain configurati.

        Returns:
            Lista di Vdom (conterrà sempre almeno "root")
        """
        endpoint = "/cmdb/system/vdom"
        raw_data = await self._make_request(endpoint, params={"vdom": "root"})

        vdoms: List[Vdom] = []
        validation_errors = 0

        for item in raw_data:
            try:
                vdom = Vdom.model_validate(item)
                vdoms.append(vdom)
            except ValidationError as e:
                validation_errors += 1
                logger.debug(f"VDOM validation failed: {e.error_count()} errors")

        if validation_errors > 0:
            logger.warning(
                f"Skipped {validation_errors} invalid VDOMs from {self.ip_address}"
            )

        logger.info(
            f"Retrieved {len(vdoms)} VDOMs: {[v.name for v in vdoms]}",
            extra={"host": self.ip_address}
        )

        return vdoms

    def __repr__(self) -> str:
        """Rappresentazione stringa del client."""
        status = "connected" if self.is_connected else "disconnected"
        return f"<FortiGateClient({self.ip_address}) [{status}]>"
