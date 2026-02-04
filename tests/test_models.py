"""
Tests for domain.models module.
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from domain.models import Route, NetworkInterface, Vdom, FirewallConfig, ScanResult


class TestRoute:
    """Test suite per il modello Route."""

    def test_route_creation_with_aliases(self):
        """Verifica creazione Route usando i nomi alias del JSON FortiGate."""
        route = Route(
            ip_mask="10.0.0.0/8",
            gateway="192.168.1.1",
            interface="port1",
            type="static",
            distance=10,
            metric=0,
        )

        assert route.destination == "10.0.0.0/8"
        assert route.protocol == "static"
        assert route.gateway == "192.168.1.1"

    def test_route_is_default_route_property(self):
        """Verifica la property is_default_route."""
        default = Route(
            ip_mask="0.0.0.0/0",
            gateway="10.0.0.1",
            interface="port1",
            type="static",
            distance=10,
            metric=0,
        )

        specific = Route(
            ip_mask="192.168.1.0/24",
            gateway="10.0.0.1",
            interface="port1",
            type="connected",
            distance=0,
            metric=0,
        )

        assert default.is_default_route is True
        assert specific.is_default_route is False

    def test_route_install_datetime_conversion(self):
        """Verifica conversione timestamp in datetime."""
        route = Route(
            ip_mask="0.0.0.0/0",
            gateway="10.0.0.1",
            interface="port1",
            type="static",
            distance=10,
            metric=0,
            install_date=1700000000,
        )

        assert route.install_datetime is not None
        assert isinstance(route.install_datetime, datetime)

    def test_route_install_datetime_none_when_missing(self):
        """Verifica che install_datetime sia None se install_date manca."""
        route = Route(
            ip_mask="0.0.0.0/0",
            gateway="10.0.0.1",
            interface="port1",
            type="static",
            distance=10,
            metric=0,
        )

        assert route.install_datetime is None


class TestNetworkInterface:
    """Test suite per il modello NetworkInterface."""

    def test_interface_parses_ip_and_mask(self):
        """Verifica che ip e mask vengano separati correttamente."""
        iface = NetworkInterface(
            name="VLAN10",
            vdom="root",
            type="vlan",
            mode="static",
            ip="172.26.26.1 255.255.255.0",
            status="up",
        )

        assert iface.ip == "172.26.26.1"
        assert iface.mask == "255.255.255.0"

    def test_interface_status_parsing(self):
        """Verifica conversione status stringa in booleano."""
        up = NetworkInterface(
            name="port1",
            vdom="root",
            type="physical",
            mode="static",
            ip="10.0.0.1",
            status="up",
        )

        down = NetworkInterface(
            name="port2",
            vdom="root",
            type="physical",
            mode="static",
            ip="10.0.0.2",
            status="down",
        )

        assert up.is_up is True
        assert down.is_up is False

    def test_interface_with_vlan_id(self):
        """Verifica parsing VLAN ID."""
        iface = NetworkInterface(
            name="VLAN100",
            vdom="root",
            type="vlan",
            mode="static",
            interface="port1",  # Parent interface (alias)
            vlanid=100,
            ip="192.168.100.1 255.255.255.0",
            status="up",
        )

        assert iface.vlan_id == 100
        assert iface.parent_interface == "port1"

    def test_interface_cidr_property(self):
        """Verifica la property cidr."""
        iface = NetworkInterface(
            name="test",
            vdom="root",
            type="vlan",
            mode="static",
            ip="192.168.1.1 255.255.255.0",
            status="up",
        )

        assert iface.cidr == "192.168.1.1/24"

    def test_interface_cidr_without_mask(self):
        """Verifica cidr quando mask non è presente."""
        iface = NetworkInterface(
            name="test",
            vdom="root",
            type="physical",
            mode="static",
            ip="10.0.0.1",
            status="up",
        )

        assert iface.cidr == "10.0.0.1"


class TestVdom:
    """Test suite per il modello Vdom."""

    def test_vdom_creation(self):
        """Verifica creazione base Vdom."""
        vdom = Vdom(name="test-vdom", **{"short-name": "test"})

        assert vdom.name == "test-vdom"
        assert vdom.short_name == "test"

    def test_vdom_is_root_property(self):
        """Verifica la property is_root."""
        root = Vdom(name="root", **{"short-name": "root"})
        other = Vdom(name="Production", **{"short-name": "prod"})

        assert root.is_root is True
        assert other.is_root is False

    def test_vdom_is_root_case_insensitive(self):
        """Verifica che is_root sia case-insensitive."""
        root_upper = Vdom(name="ROOT", **{"short-name": "ROOT"})
        root_mixed = Vdom(name="Root", **{"short-name": "Root"})

        assert root_upper.is_root is True
        assert root_mixed.is_root is True


class TestFirewallConfig:
    """Test suite per il modello FirewallConfig."""

    def test_firewall_config_creation(self):
        """Verifica creazione base FirewallConfig."""
        config = FirewallConfig(
            id="fw-test",
            host="10.0.0.1:443",
            token="secret-token",
        )

        assert config.id == "fw-test"
        assert config.host == "10.0.0.1:443"
        assert config.token == "secret-token"
        assert config.entry_vdom == "root"  # Default
        assert config.enabled is True  # Default

    def test_firewall_config_validates_host_format(self):
        """Verifica che host debba includere la porta."""
        with pytest.raises(ValidationError) as exc_info:
            FirewallConfig(
                id="fw-test",
                host="10.0.0.1",  # Manca la porta
                token="secret",
            )

        assert "porta" in str(exc_info.value).lower()

    def test_firewall_config_validates_port_is_numeric(self):
        """Verifica che la porta sia numerica."""
        with pytest.raises(ValidationError):
            FirewallConfig(
                id="fw-test",
                host="10.0.0.1:abc",  # Porta non numerica
                token="secret",
            )

    def test_firewall_config_disabled(self):
        """Verifica che enabled possa essere False."""
        config = FirewallConfig(
            id="fw-disabled",
            host="10.0.0.1:443",
            token="secret",
            enabled=False,
        )

        assert config.enabled is False


class TestScanResult:
    """Test suite per il modello ScanResult."""

    def test_scan_result_success(self):
        """Verifica creazione ScanResult di successo."""
        result = ScanResult(
            firewall_id="fw-test",
            firewall_host="10.0.0.1:443",
            success=True,
            vdoms_count=3,
            routes_count=150,
            interfaces_count=25,
            scan_duration_ms=1500.5,
        )

        assert result.success is True
        assert result.error_message is None
        assert result.vdoms_count == 3

    def test_scan_result_failure(self):
        """Verifica creazione ScanResult di fallimento."""
        result = ScanResult(
            firewall_id="fw-test",
            firewall_host="10.0.0.1:443",
            success=False,
            error_message="Connection timeout",
        )

        assert result.success is False
        assert result.error_message == "Connection timeout"
        assert result.vdoms_count == 0  # Default
