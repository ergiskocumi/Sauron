import httpx
import pytest

from infrastructure.fortigate_client import FortiGateClient


class _MockResponse:
    def __init__(self, json_data, status_code=200):
        self._json_data = json_data
        self.status_code = status_code

    def json(self):
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "error", request=httpx.Request("GET", "https://example"), response=httpx.Response(self.status_code)
            )


class _MockAsyncClient:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url, headers=None, params=None):
        return self._response


@pytest.mark.asyncio
async def test_make_request_handles_results_list(monkeypatch):
    response = _MockResponse({"results": [{"a": 1}, {"a": 2}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _MockAsyncClient(response))

    client = FortiGateClient(ip_address="1.2.3.4", api_token="token")
    data = await client._make_request("/test")

    assert data == [{"a": 1}, {"a": 2}]


@pytest.mark.asyncio
async def test_make_request_handles_results_dict(monkeypatch):
    response = _MockResponse({"results": {"k1": {"a": 1}, "k2": {"a": 2}}})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _MockAsyncClient(response))

    client = FortiGateClient(ip_address="1.2.3.4", api_token="token")
    data = await client._make_request("/test")

    assert data == [{"a": 1}, {"a": 2}]


@pytest.mark.asyncio
async def test_get_routing_table_parses_routes(monkeypatch):
    client = FortiGateClient(ip_address="1.2.3.4", api_token="token")

    async def _fake_make_request(endpoint, params=None):
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
            }
        ]

    monkeypatch.setattr(client, "_make_request", _fake_make_request)

    routes = await client.get_routing_table()
    assert len(routes) == 1
    assert routes[0].is_default_route is True


@pytest.mark.asyncio
async def test_get_interfaces_parses_vlan(monkeypatch):
    client = FortiGateClient(ip_address="1.2.3.4", api_token="token")

    async def _fake_make_request(endpoint, params=None):
        return [
            {
                "name": "VLAN10",
                "alias": "Test",
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

    monkeypatch.setattr(client, "_make_request", _fake_make_request)

    interfaces = await client.get_interfaces(vdom="root", type_filter="vlan")
    assert len(interfaces) == 1
    assert interfaces[0].vlan_id == 10
    assert interfaces[0].is_up is True


@pytest.mark.asyncio
async def test_get_vdoms_parses_list(monkeypatch):
    client = FortiGateClient(ip_address="1.2.3.4", api_token="token")

    async def _fake_make_request(endpoint, params=None):
        return [{"name": "root", "short-name": "root"}]

    monkeypatch.setattr(client, "_make_request", _fake_make_request)

    vdoms = await client.get_vdoms()
    assert len(vdoms) == 1
    assert vdoms[0].is_root is True
