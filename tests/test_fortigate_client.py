"""
Tests for infrastructure.fortigate_client module.
"""

import pytest
import httpx

from infrastructure.fortigate_client import FortiGateClient
from domain.ports import AuthenticationError
from core.config import get_settings


class MockResponse:
    """Mock per httpx.Response."""

    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "error",
                request=httpx.Request("GET", "https://example"),
                response=httpx.Response(self.status_code),
            )


class MockAsyncClient:
    """Mock per httpx.AsyncClient con context manager."""

    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def request(self, method, url, headers=None, params=None):
        return self._response

    async def aclose(self):
        pass


@pytest.fixture
def client():
    """Fixture per creare un FortiGateClient."""
    get_settings.cache_clear()
    return FortiGateClient(ip_address="1.2.3.4:443", api_token="test-token")


@pytest.mark.asyncio
async def test_client_connect_and_disconnect(client):
    """Verifica che connect e disconnect funzionino correttamente."""
    assert client.is_connected is False

    await client.connect()
    assert client.is_connected is True

    await client.disconnect()
    assert client.is_connected is False


@pytest.mark.asyncio
async def test_client_context_manager(client):
    """Verifica il supporto context manager."""
    assert client.is_connected is False

    async with client:
        assert client.is_connected is True

    assert client.is_connected is False


@pytest.mark.asyncio
async def test_make_request_extracts_results_list(client, monkeypatch):
    """Verifica che _make_request estragga correttamente una lista di risultati."""
    response = MockResponse({"results": [{"a": 1}, {"a": 2}]})

    async def mock_request(*args, **kwargs):
        return response

    await client.connect()
    monkeypatch.setattr(client._client, "request", mock_request)

    data = await client._make_request("/test")
    assert data == [{"a": 1}, {"a": 2}]

    await client.disconnect()


@pytest.mark.asyncio
async def test_make_request_extracts_results_dict(client, monkeypatch):
    """Verifica che _make_request converta un dict in lista."""
    response = MockResponse({"results": {"k1": {"a": 1}, "k2": {"a": 2}}})

    async def mock_request(*args, **kwargs):
        return response

    await client.connect()
    monkeypatch.setattr(client._client, "request", mock_request)

    data = await client._make_request("/test")
    assert len(data) == 2
    assert {"a": 1} in data
    assert {"a": 2} in data

    await client.disconnect()


@pytest.mark.asyncio
async def test_get_routing_table_parses_routes(client, monkeypatch):
    """Verifica che get_routing_table parsi correttamente le rotte."""

    async def mock_make_request(endpoint, params=None):
        return [
            {
                "ip_mask": "0.0.0.0/0",
                "gateway": "10.0.0.1",
                "interface": "port1",
                "type": "static",
                "distance": 10,
                "metric": 0,
                "priority": 1,
                "vrf": 0,
                "install_date": 1700000000,
            },
            {
                "ip_mask": "192.168.1.0/24",
                "gateway": "0.0.0.0",
                "interface": "port2",
                "type": "connected",
                "distance": 0,
                "metric": 0,
                "priority": 1,
                "vrf": 0,
            },
        ]

    monkeypatch.setattr(client, "_make_request", mock_make_request)

    routes = await client.get_routing_table(vdom="root")

    assert len(routes) == 2
    assert routes[0].is_default_route is True
    assert routes[0].protocol == "static"
    assert routes[1].destination == "192.168.1.0/24"


@pytest.mark.asyncio
async def test_get_interfaces_parses_vlan(client, monkeypatch):
    """Verifica che get_interfaces parsi correttamente le VLAN."""

    async def mock_make_request(endpoint, params=None):
        return [
            {
                "name": "VLAN10",
                "alias": "Test VLAN",
                "vdom": "root",
                "type": "vlan",
                "mode": "static",
                "mtu": 1500,
                "interface": "port1",
                "vlanid": 10,
                "ip": "172.26.26.1 255.255.255.0",
                "status": "up",
                "allowaccess": "ping https",
            }
        ]

    monkeypatch.setattr(client, "_make_request", mock_make_request)

    interfaces = await client.get_interfaces(vdom="root", type_filter="vlan")

    assert len(interfaces) == 1
    assert interfaces[0].name == "VLAN10"
    assert interfaces[0].vlan_id == 10
    assert interfaces[0].is_up is True
    assert interfaces[0].ip == "172.26.26.1"
    assert interfaces[0].mask == "255.255.255.0"


@pytest.mark.asyncio
async def test_get_interfaces_filters_wrong_vdom(client, monkeypatch):
    """Verifica che interfacce di altri VDOM vengano filtrate."""

    async def mock_make_request(endpoint, params=None):
        return [
            {
                "name": "VLAN10",
                "vdom": "root",
                "type": "vlan",
                "mode": "static",
                "ip": "10.0.0.1",
                "status": "up",
            },
            {
                "name": "VLAN20",
                "vdom": "other-vdom",  # Diverso dal VDOM richiesto
                "type": "vlan",
                "mode": "static",
                "ip": "10.0.0.2",
                "status": "up",
            },
        ]

    monkeypatch.setattr(client, "_make_request", mock_make_request)

    interfaces = await client.get_interfaces(vdom="root")

    assert len(interfaces) == 1
    assert interfaces[0].name == "VLAN10"


@pytest.mark.asyncio
async def test_get_vdoms_parses_list(client, monkeypatch):
    """Verifica che get_vdoms parsi correttamente la lista VDOM."""

    async def mock_make_request(endpoint, params=None):
        return [
            {"name": "root", "short-name": "root"},
            {"name": "Production", "short-name": "prod"},
        ]

    monkeypatch.setattr(client, "_make_request", mock_make_request)

    vdoms = await client.get_vdoms()

    assert len(vdoms) == 2
    assert vdoms[0].is_root is True
    assert vdoms[1].name == "Production"


@pytest.mark.asyncio
async def test_get_routing_table_skips_invalid_routes(client, monkeypatch):
    """Verifica che rotte non valide vengano saltate senza errore."""

    async def mock_make_request(endpoint, params=None):
        return [
            {
                "ip_mask": "0.0.0.0/0",
                "gateway": "10.0.0.1",
                "interface": "port1",
                "type": "static",
                "distance": 10,
                "metric": 0,
            },
            {
                # Mancano campi obbligatori
                "ip_mask": "invalid",
            },
        ]

    monkeypatch.setattr(client, "_make_request", mock_make_request)

    routes = await client.get_routing_table()

    # Solo la prima rotta valida deve essere inclusa
    assert len(routes) == 1


@pytest.mark.asyncio
async def test_client_repr(client):
    """Verifica la rappresentazione stringa del client."""
    assert "1.2.3.4:443" in repr(client)
    assert "disconnected" in repr(client)

    await client.connect()
    assert "connected" in repr(client)

    await client.disconnect()
