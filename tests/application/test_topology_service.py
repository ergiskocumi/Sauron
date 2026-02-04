"""
Tests for TopologyService.

Test coverage:
- Network ID canonicalization
- Bucketing by subnet
- Link extraction (2+ nodes)
- Isolated interfaces (no link)
- Point-to-point links (/30)
- Adjacency list construction
- IP index lookup
"""

import pytest
from typing import List

from application.models.topology import Node, InterfaceRecord, Link, Topology
from application.services.topology_service import TopologyService


class TestInterfaceRecord:
    """Test suite per InterfaceRecord e conversioni IP."""

    def test_ip_to_int_conversion(self):
        """Verifica conversione IP stringa -> uint32."""
        assert InterfaceRecord._ip_to_int("0.0.0.0") == 0
        assert InterfaceRecord._ip_to_int("255.255.255.255") == 0xFFFFFFFF
        assert InterfaceRecord._ip_to_int("192.168.1.1") == 3232235777
        assert InterfaceRecord._ip_to_int("10.0.0.1") == 167772161

    def test_int_to_ip_conversion(self):
        """Verifica conversione uint32 -> IP stringa."""
        assert InterfaceRecord._int_to_ip(0) == "0.0.0.0"
        assert InterfaceRecord._int_to_ip(0xFFFFFFFF) == "255.255.255.255"
        assert InterfaceRecord._int_to_ip(3232235777) == "192.168.1.1"
        assert InterfaceRecord._int_to_ip(167772161) == "10.0.0.1"

    def test_prefix_to_mask(self):
        """Verifica conversione prefix length -> subnet mask."""
        assert InterfaceRecord._prefix_to_mask(0) == 0
        assert InterfaceRecord._prefix_to_mask(8) == 0xFF000000
        assert InterfaceRecord._prefix_to_mask(16) == 0xFFFF0000
        assert InterfaceRecord._prefix_to_mask(24) == 0xFFFFFF00
        assert InterfaceRecord._prefix_to_mask(32) == 0xFFFFFFFF

    def test_network_id_calculation(self):
        """Verifica calcolo network_id canonico."""
        # 192.168.1.100/24 -> 192.168.1.0/24
        iface = InterfaceRecord(
            device_id="fw1",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("192.168.1.100"),
            prefix_len=24,
            is_up=True,
        )
        assert iface.network_id == "192.168.1.0/24"

        # 10.0.5.1/8 -> 10.0.0.0/8
        iface2 = InterfaceRecord(
            device_id="fw1",
            vdom="root",
            iface_name="port2",
            ip=InterfaceRecord._ip_to_int("10.0.5.1"),
            prefix_len=8,
            is_up=True,
        )
        assert iface2.network_id == "10.0.0.0/8"


class TestNode:
    """Test suite per Node."""

    def test_node_creation(self):
        """Verifica creazione Node."""
        node = Node(device_id="fw-milano", vdom="root")
        assert node.device_id == "fw-milano"
        assert node.vdom == "root"
        assert node.node_key == "fw-milano:root"

    def test_node_equality(self):
        """Verifica uguaglianza tra nodi."""
        node1 = Node(device_id="fw1", vdom="root")
        node2 = Node(device_id="fw1", vdom="root")
        node3 = Node(device_id="fw1", vdom="prod")

        assert node1 == node2
        assert node1 != node3

    def test_node_hashable(self):
        """Verifica che Node sia hashable per uso in Set."""
        node1 = Node(device_id="fw1", vdom="root")
        node2 = Node(device_id="fw1", vdom="root")
        node3 = Node(device_id="fw2", vdom="root")

        node_set = {node1, node2, node3}
        assert len(node_set) == 2  # node1 e node2 sono uguali


class TestTopologyService:
    """Test suite per TopologyService."""

    @pytest.fixture
    def service(self) -> TopologyService:
        """Fixture per il servizio."""
        return TopologyService()

    @pytest.fixture
    def two_firewalls_same_subnet(self) -> List[InterfaceRecord]:
        """Due firewall sulla stessa subnet /24."""
        return [
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.1"),
                prefix_len=24,
                is_up=True,
            ),
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.2"),
                prefix_len=24,
                is_up=True,
            ),
        ]

    @pytest.fixture
    def three_firewalls_two_subnets(self) -> List[InterfaceRecord]:
        """
        Topologia:
        fw1 ----[192.168.1.0/24]---- fw2 ----[10.0.0.0/24]---- fw3
        """
        return [
            # fw1 su 192.168.1.0/24
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.1"),
                prefix_len=24,
                is_up=True,
            ),
            # fw2 su 192.168.1.0/24 (verso fw1)
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.2"),
                prefix_len=24,
                is_up=True,
            ),
            # fw2 su 10.0.0.0/24 (verso fw3)
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="port2",
                ip=InterfaceRecord._ip_to_int("10.0.0.1"),
                prefix_len=24,
                is_up=True,
            ),
            # fw3 su 10.0.0.0/24
            InterfaceRecord(
                device_id="fw3",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("10.0.0.2"),
                prefix_len=24,
                is_up=True,
            ),
        ]

    def test_build_topology_empty(self, service: TopologyService):
        """Test con lista vuota."""
        topology = service.build_topology([])
        assert topology.node_count == 0
        assert topology.link_count == 0

    def test_build_topology_single_interface(self, service: TopologyService):
        """Test con singola interfaccia (nessun link)."""
        interfaces = [
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.1"),
                prefix_len=24,
                is_up=True,
            ),
        ]

        topology = service.build_topology(interfaces)

        assert topology.node_count == 1
        assert topology.link_count == 0  # Nessun link, solo 1 nodo
        assert "fw1:root" in topology.nodes

    def test_build_topology_two_nodes_same_subnet(
        self,
        service: TopologyService,
        two_firewalls_same_subnet: List[InterfaceRecord],
    ):
        """Test con due nodi sulla stessa subnet -> crea link."""
        topology = service.build_topology(two_firewalls_same_subnet)

        assert topology.node_count == 2
        assert topology.link_count == 1

        link = topology.links[0]
        assert link.subnet == "192.168.1.0/24"
        assert "fw1:root" in link.endpoints
        assert "fw2:root" in link.endpoints

    def test_build_topology_three_nodes_chain(
        self,
        service: TopologyService,
        three_firewalls_two_subnets: List[InterfaceRecord],
    ):
        """Test topologia a catena: fw1 -- fw2 -- fw3."""
        topology = service.build_topology(three_firewalls_two_subnets)

        assert topology.node_count == 3
        assert topology.link_count == 2

        # Verifica subnets
        subnets = {link.subnet for link in topology.links}
        assert "192.168.1.0/24" in subnets
        assert "10.0.0.0/24" in subnets

    def test_adjacency_list_built_correctly(
        self,
        service: TopologyService,
        two_firewalls_same_subnet: List[InterfaceRecord],
    ):
        """Verifica costruzione adjacency list."""
        topology = service.build_topology(two_firewalls_same_subnet)

        # fw1 deve avere fw2 come vicino
        assert "fw1:root" in topology.adjacency
        neighbors_fw1 = topology.adjacency["fw1:root"]
        assert len(neighbors_fw1) == 1
        assert neighbors_fw1[0][0] == "fw2:root"

        # fw2 deve avere fw1 come vicino (bidirezionale)
        assert "fw2:root" in topology.adjacency
        neighbors_fw2 = topology.adjacency["fw2:root"]
        assert len(neighbors_fw2) == 1
        assert neighbors_fw2[0][0] == "fw1:root"

    def test_get_neighbors(
        self,
        service: TopologyService,
        three_firewalls_two_subnets: List[InterfaceRecord],
    ):
        """Test metodo get_neighbors."""
        topology = service.build_topology(three_firewalls_two_subnets)

        # fw2 ha 2 vicini (fw1 e fw3)
        fw2 = Node(device_id="fw2", vdom="root")
        neighbors = service.get_neighbors(topology, fw2)

        neighbor_keys = {n.node_key for n, _ in neighbors}
        assert "fw1:root" in neighbor_keys
        assert "fw3:root" in neighbor_keys

    def test_find_node_by_ip(
        self,
        service: TopologyService,
        two_firewalls_same_subnet: List[InterfaceRecord],
    ):
        """Test lookup nodo per IP."""
        topology = service.build_topology(two_firewalls_same_subnet)

        result = service.find_node_by_ip(topology, "192.168.1.1")
        assert result is not None
        node, iface = result
        assert node.device_id == "fw1"
        assert iface.iface_name == "port1"

    def test_find_node_by_ip_not_found(
        self,
        service: TopologyService,
        two_firewalls_same_subnet: List[InterfaceRecord],
    ):
        """Test lookup IP non esistente."""
        topology = service.build_topology(two_firewalls_same_subnet)

        result = service.find_node_by_ip(topology, "10.10.10.10")
        assert result is None

    def test_down_interface_excluded(self, service: TopologyService):
        """Interfacce DOWN non devono creare link."""
        interfaces = [
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.1"),
                prefix_len=24,
                is_up=True,
            ),
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.2"),
                prefix_len=24,
                is_up=False,  # DOWN!
            ),
        ]

        topology = service.build_topology(interfaces)

        # No link perche' fw2 e' DOWN
        assert topology.link_count == 0

    def test_host_route_excluded(self, service: TopologyService):
        """Interfacce /32 (host route) non creano link."""
        interfaces = [
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="loopback",
                ip=InterfaceRecord._ip_to_int("1.1.1.1"),
                prefix_len=32,  # Host route
                is_up=True,
            ),
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="loopback",
                ip=InterfaceRecord._ip_to_int("1.1.1.2"),
                prefix_len=32,  # Host route
                is_up=True,
            ),
        ]

        topology = service.build_topology(interfaces)

        # No link per /32
        assert topology.link_count == 0

    def test_point_to_point_link(self, service: TopologyService):
        """Test link point-to-point /30."""
        interfaces = [
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="tunnel0",
                ip=InterfaceRecord._ip_to_int("172.16.0.1"),
                prefix_len=30,
                is_up=True,
            ),
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="tunnel0",
                ip=InterfaceRecord._ip_to_int("172.16.0.2"),
                prefix_len=30,
                is_up=True,
            ),
        ]

        topology = service.build_topology(interfaces)

        assert topology.link_count == 1
        link = topology.links[0]
        assert link.is_point_to_point is True
        assert link.subnet == "172.16.0.0/30"

    def test_multi_vdom_same_device(self, service: TopologyService):
        """Test VDOM multipli sullo stesso device."""
        interfaces = [
            # fw1:root su una subnet
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.1"),
                prefix_len=24,
                is_up=True,
            ),
            # fw1:prod su un'altra subnet
            InterfaceRecord(
                device_id="fw1",
                vdom="prod",
                iface_name="port2",
                ip=InterfaceRecord._ip_to_int("10.0.0.1"),
                prefix_len=24,
                is_up=True,
            ),
            # fw2:root su 192.168.1.0/24 (connesso a fw1:root)
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.2"),
                prefix_len=24,
                is_up=True,
            ),
            # fw2:root anche su 10.0.0.0/24 (connesso a fw1:prod)
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="port2",
                ip=InterfaceRecord._ip_to_int("10.0.0.2"),
                prefix_len=24,
                is_up=True,
            ),
        ]

        topology = service.build_topology(interfaces)

        # 3 nodi: fw1:root, fw1:prod, fw2:root
        assert topology.node_count == 3

        # 2 link: 192.168.1.0/24 e 10.0.0.0/24
        assert topology.link_count == 2

    def test_three_nodes_same_switch(self, service: TopologyService):
        """
        Test 3+ firewall sulla stessa subnet (switch L2 invisibile).
        Deve creare un singolo link con 3 endpoints.
        """
        interfaces = [
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.1"),
                prefix_len=24,
                is_up=True,
            ),
            InterfaceRecord(
                device_id="fw2",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.2"),
                prefix_len=24,
                is_up=True,
            ),
            InterfaceRecord(
                device_id="fw3",
                vdom="root",
                iface_name="port1",
                ip=InterfaceRecord._ip_to_int("192.168.1.3"),
                prefix_len=24,
                is_up=True,
            ),
        ]

        topology = service.build_topology(interfaces)

        assert topology.node_count == 3
        assert topology.link_count == 1  # Singolo link

        link = topology.links[0]
        assert link.endpoint_count == 3
        assert "fw1:root" in link.endpoints
        assert "fw2:root" in link.endpoints
        assert "fw3:root" in link.endpoints
