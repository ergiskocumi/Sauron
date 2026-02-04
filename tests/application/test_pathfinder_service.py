"""
Tests for PathfinderService.

Test coverage:
- LPM (Longest Prefix Match) algorithm
- Connected route reaches target
- Gateway route transitions to next hop
- Loop detection
- TTL exceeded
- Exit WAN detection
- No route drops packet
"""

import pytest
from typing import Dict, List

from application.models.topology import Node, InterfaceRecord, Topology
from application.models.pathfinder import PathStatus, HopResult, PathResult
from application.services.topology_service import TopologyService
from application.services.pathfinder_service import PathfinderService
from domain.models import Route


class TestLPM:
    """Test suite per Longest Prefix Match."""

    @pytest.fixture
    def service(self) -> PathfinderService:
        """Fixture per il servizio."""
        return PathfinderService()

    def test_lpm_exact_match(self, service: PathfinderService):
        """Test match esatto su route specifica."""
        routes = [
            Route(
                ip_mask="10.0.0.0/8",
                gateway="192.168.1.1",
                interface="port1",
                type="static",
                distance=10,
                metric=0,
            ),
            Route(
                ip_mask="10.1.0.0/16",
                gateway="192.168.1.2",
                interface="port2",
                type="static",
                distance=10,
                metric=0,
            ),
            Route(
                ip_mask="10.1.1.0/24",
                gateway="192.168.1.3",
                interface="port3",
                type="static",
                distance=10,
                metric=0,
            ),
        ]

        # Target 10.1.1.5 deve matchare /24 (piu' lungo)
        target_ip = service._ip_to_int("10.1.1.5")
        matched = service._longest_prefix_match(routes, target_ip)

        assert matched is not None
        assert matched.destination == "10.1.1.0/24"
        assert matched.gateway == "192.168.1.3"

    def test_lpm_default_route_fallback(self, service: PathfinderService):
        """Test fallback su default route."""
        routes = [
            Route(
                ip_mask="0.0.0.0/0",
                gateway="10.0.0.1",
                interface="wan",
                type="static",
                distance=10,
                metric=0,
            ),
            Route(
                ip_mask="192.168.0.0/16",
                gateway="192.168.1.1",
                interface="lan",
                type="static",
                distance=10,
                metric=0,
            ),
        ]

        # Target 8.8.8.8 non matcha /16, deve usare default
        target_ip = service._ip_to_int("8.8.8.8")
        matched = service._longest_prefix_match(routes, target_ip)

        assert matched is not None
        assert matched.destination == "0.0.0.0/0"

    def test_lpm_no_match(self, service: PathfinderService):
        """Test nessun match disponibile."""
        routes = [
            Route(
                ip_mask="192.168.0.0/16",
                gateway="10.0.0.1",
                interface="lan",
                type="static",
                distance=10,
                metric=0,
            ),
        ]

        # Target 10.0.0.5 non matcha nessuna route
        target_ip = service._ip_to_int("10.0.0.5")
        matched = service._longest_prefix_match(routes, target_ip)

        assert matched is None


class TestPathfinderService:
    """Test suite per PathfinderService."""

    @pytest.fixture
    def service(self) -> PathfinderService:
        """Fixture per il servizio."""
        return PathfinderService()

    @pytest.fixture
    def topology_service(self) -> TopologyService:
        """Fixture per TopologyService."""
        return TopologyService()

    @pytest.fixture
    def simple_chain_topology(
        self,
        topology_service: TopologyService,
    ) -> Topology:
        """
        Topologia semplice a catena:
        fw1 ----[192.168.1.0/24]---- fw2 ----[10.0.0.0/24]---- fw3
        """
        interfaces = [
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
        return topology_service.build_topology(interfaces)

    @pytest.fixture
    def simple_chain_routes(self) -> Dict[str, List[Route]]:
        """Routing tables per topologia a catena."""
        return {
            "fw1:root": [
                # Connected
                Route(
                    ip_mask="192.168.1.0/24",
                    gateway="0.0.0.0",
                    interface="port1",
                    type="connected",
                    distance=0,
                    metric=0,
                ),
                # Route verso 10.0.0.0/24 via fw2
                Route(
                    ip_mask="10.0.0.0/24",
                    gateway="192.168.1.2",
                    interface="port1",
                    type="static",
                    distance=10,
                    metric=0,
                ),
            ],
            "fw2:root": [
                # Connected
                Route(
                    ip_mask="192.168.1.0/24",
                    gateway="0.0.0.0",
                    interface="port1",
                    type="connected",
                    distance=0,
                    metric=0,
                ),
                Route(
                    ip_mask="10.0.0.0/24",
                    gateway="0.0.0.0",
                    interface="port2",
                    type="connected",
                    distance=0,
                    metric=0,
                ),
            ],
            "fw3:root": [
                # Connected
                Route(
                    ip_mask="10.0.0.0/24",
                    gateway="0.0.0.0",
                    interface="port1",
                    type="connected",
                    distance=0,
                    metric=0,
                ),
                # Route verso 192.168.1.0/24 via fw2
                Route(
                    ip_mask="192.168.1.0/24",
                    gateway="10.0.0.1",
                    interface="port1",
                    type="static",
                    distance=10,
                    metric=0,
                ),
            ],
        }

    def test_connected_route_reaches_target(
        self,
        service: PathfinderService,
        simple_chain_topology: Topology,
        simple_chain_routes: Dict[str, List[Route]],
    ):
        """Test: pacchetto destinato a rete connected."""
        start_node = Node(device_id="fw1", vdom="root")

        # Target su rete connected di fw1
        result = service.find_path(
            topology=simple_chain_topology,
            routing_tables=simple_chain_routes,
            start_node=start_node,
            target_ip="192.168.1.100",
        )

        assert result.status == PathStatus.REACHED
        assert result.total_hops == 1
        assert result.hops[0].action == "connected"

    def test_gateway_route_transitions(
        self,
        service: PathfinderService,
        simple_chain_topology: Topology,
        simple_chain_routes: Dict[str, List[Route]],
    ):
        """Test: pacchetto attraversa gateway per raggiungere target."""
        start_node = Node(device_id="fw1", vdom="root")

        # Target su rete di fw3 (deve passare per fw2)
        result = service.find_path(
            topology=simple_chain_topology,
            routing_tables=simple_chain_routes,
            start_node=start_node,
            target_ip="10.0.0.100",
        )

        assert result.status == PathStatus.REACHED
        # fw1 -> fw2 (forward) -> fw2 reaches via connected
        assert result.total_hops >= 2
        # Hop 2 ingress should be fw2 port1 (gateway IP on 192.168.1.0/24)
        if result.total_hops >= 2:
            assert result.hops[1].ingress_interface == "port1"

    def test_no_route_drops_packet(
        self,
        service: PathfinderService,
        simple_chain_topology: Topology,
    ):
        """Test: no route to destination causa DROP."""
        start_node = Node(device_id="fw1", vdom="root")

        # Routing table vuota
        empty_routes: Dict[str, List[Route]] = {"fw1:root": []}

        result = service.find_path(
            topology=simple_chain_topology,
            routing_tables=empty_routes,
            start_node=start_node,
            target_ip="8.8.8.8",
        )

        assert result.status == PathStatus.DROPPED
        assert result.is_reachable is False

    def test_loop_detection(
        self,
        service: PathfinderService,
        topology_service: TopologyService,
    ):
        """Test: rilevamento loop di routing."""
        # Topologia: fw1 <-> fw2 con routing che crea loop
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
        ]

        topology = topology_service.build_topology(interfaces)

        # Routes che creano loop: fw1 -> fw2 -> fw1
        loop_routes = {
            "fw1:root": [
                Route(
                    ip_mask="192.168.1.0/24",
                    gateway="0.0.0.0",
                    interface="port1",
                    type="connected",
                    distance=0,
                    metric=0,
                ),
                Route(
                    ip_mask="10.0.0.0/8",
                    gateway="192.168.1.2",  # -> fw2
                    interface="port1",
                    type="static",
                    distance=10,
                    metric=0,
                ),
            ],
            "fw2:root": [
                Route(
                    ip_mask="192.168.1.0/24",
                    gateway="0.0.0.0",
                    interface="port1",
                    type="connected",
                    distance=0,
                    metric=0,
                ),
                Route(
                    ip_mask="10.0.0.0/8",
                    gateway="192.168.1.1",  # -> fw1 (LOOP!)
                    interface="port1",
                    type="static",
                    distance=10,
                    metric=0,
                ),
            ],
        }

        start_node = Node(device_id="fw1", vdom="root")

        result = service.find_path(
            topology=topology,
            routing_tables=loop_routes,
            start_node=start_node,
            target_ip="10.0.0.5",
        )

        assert result.status == PathStatus.LOOP
        assert result.is_reachable is False

    def test_ttl_exceeded(
        self,
        service: PathfinderService,
        simple_chain_topology: Topology,
        simple_chain_routes: Dict[str, List[Route]],
    ):
        """Test: TTL exceeded ferma il path."""
        start_node = Node(device_id="fw1", vdom="root")

        # max_ttl=1 significa che dopo il primo hop si ferma
        result = service.find_path(
            topology=simple_chain_topology,
            routing_tables=simple_chain_routes,
            start_node=start_node,
            target_ip="10.0.0.100",
            max_ttl=1,  # Solo 1 hop permesso
        )

        # Con TTL=1, dopo fw1 il pacchetto viene droppato
        # Dipende dall'implementazione esatta
        assert result.total_hops <= 1

    def test_exit_wan_on_default_route(
        self,
        service: PathfinderService,
        topology_service: TopologyService,
    ):
        """Test: pacchetto esce via WAN su default route."""
        interfaces = [
            InterfaceRecord(
                device_id="fw1",
                vdom="root",
                iface_name="lan",
                ip=InterfaceRecord._ip_to_int("192.168.1.1"),
                prefix_len=24,
                is_up=True,
            ),
        ]

        topology = topology_service.build_topology(interfaces)

        # Default route verso gateway esterno (non in topology)
        routes = {
            "fw1:root": [
                Route(
                    ip_mask="192.168.1.0/24",
                    gateway="0.0.0.0",
                    interface="lan",
                    type="connected",
                    distance=0,
                    metric=0,
                ),
                Route(
                    ip_mask="0.0.0.0/0",
                    gateway="203.0.113.1",  # Gateway esterno
                    interface="wan",
                    type="static",
                    distance=10,
                    metric=0,
                ),
            ],
        }

        start_node = Node(device_id="fw1", vdom="root")

        result = service.find_path(
            topology=topology,
            routing_tables=routes,
            start_node=start_node,
            target_ip="8.8.8.8",  # Internet
        )

        assert result.status == PathStatus.EXIT_WAN
        assert result.exit_gateway == "203.0.113.1"

    def test_path_result_format(
        self,
        service: PathfinderService,
        simple_chain_topology: Topology,
        simple_chain_routes: Dict[str, List[Route]],
    ):
        """Test formattazione PathResult."""
        start_node = Node(device_id="fw1", vdom="root")

        result = service.find_path(
            topology=simple_chain_topology,
            routing_tables=simple_chain_routes,
            start_node=start_node,
            target_ip="192.168.1.100",
        )

        # Verifica proprieta'
        assert result.source_node == start_node
        assert result.target_ip == "192.168.1.100"
        assert isinstance(result.format_path(), str)
        assert "fw1:root" in result.format_path()


class TestPathStatus:
    """Test per enum PathStatus."""

    def test_is_success(self):
        """Test proprieta' is_success."""
        assert PathStatus.REACHED.is_success is True
        assert PathStatus.DROPPED.is_success is False
        assert PathStatus.LOOP.is_success is False

    def test_is_failure(self):
        """Test proprieta' is_failure."""
        assert PathStatus.REACHED.is_failure is False
        assert PathStatus.DROPPED.is_failure is True
        assert PathStatus.LOOP.is_failure is True
        assert PathStatus.TTL_EXCEEDED.is_failure is True


class TestHopResult:
    """Test per HopResult."""

    def test_hop_result_creation(self):
        """Test creazione HopResult."""
        node = Node(device_id="fw1", vdom="root")
        hop = HopResult(
            node=node,
            egress_interface="port1",
            matched_route_destination="10.0.0.0/8",
            matched_route_gateway="192.168.1.2",
            matched_route_protocol="static",
            action="forward",
            next_hop_ip="192.168.1.2",
        )

        assert hop.node == node
        assert hop.action == "forward"
        assert hop.is_terminal is False

    def test_hop_terminal_actions(self):
        """Test azioni terminali."""
        node = Node(device_id="fw1", vdom="root")

        connected_hop = HopResult(node=node, action="connected")
        assert connected_hop.is_terminal is True

        drop_hop = HopResult(node=node, action="drop")
        assert drop_hop.is_terminal is True

        forward_hop = HopResult(node=node, action="forward")
        assert forward_hop.is_terminal is False
