import pytest
from domain.models import NetworkInterface, Route, Vdom


def test_route_properties_default_route_and_datetime():
    route = Route(
        ip_mask="0.0.0.0/0",
        gateway="10.0.0.1",
        interface="port1",
        type="static",
        distance=10,
        metric=0,
        priority=1,
        vrf=0,
        install_date=1700000000,
    )

    assert route.is_default_route is True
    assert route.install_datetime is not None


def test_network_interface_parses_ip_mask_and_status():
    iface = NetworkInterface(
        name="VLAN10",
        alias="Test",
        vdom="root",
        type="vlan",
        mode="static",
        mtu=1500,
        interface="port1",
        vlanid=10,
        ip="172.26.26.1 255.255.255.0",
        status="up",
        allowaccess="ping https",
    )

    assert iface.ip == "172.26.26.1"
    assert iface.mask == "255.255.255.0"
    assert iface.is_up is True
    assert iface.parent_interface == "port1"
    assert iface.vlan_id == 10


def test_vdom_is_root_property():
    vdom = Vdom(name="root", **{"short-name": "root"})
    assert vdom.is_root is True
