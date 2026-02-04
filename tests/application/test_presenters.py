"""
Tests for presenters.
"""

from application.models.pathfinder import HopResult, PathResult, PathStatus
from application.models.topology import Node
from application.presenters.console_presenter import ConsolePresenter
from application.presenters.graphviz_presenter import GraphvizPresenter
from application.services.resolver_service import NodeNotFoundError


def _sample_result() -> PathResult:
    source = Node(device_id="fw1", vdom="root")
    hop = HopResult(
        node=source,
        egress_interface="port1",
        matched_route_destination="10.0.0.0/24",
        matched_route_gateway="0.0.0.0",
        matched_route_protocol="connected",
        action="connected",
    )
    return PathResult(
        source_node=source,
        target_ip="10.0.0.5",
        hops=[hop],
        status=PathStatus.REACHED,
        exit_interface="port1",
    )


def test_console_presenter_print_path(capsys) -> None:
    presenter = ConsolePresenter()
    result = _sample_result()

    presenter.print_path_result(result)
    out = capsys.readouterr().out

    assert "TRACEROUTE SIMULATO" in out
    assert "fw1:root" in out
    assert "10.0.0.5" in out


def test_console_presenter_print_resolver_error(capsys) -> None:
    presenter = ConsolePresenter()
    error = NodeNotFoundError("Device not found", candidates=["fw1:root"])

    presenter.print_resolver_error(error)
    out = capsys.readouterr().out

    assert "ERRORE" in out
    assert "fw1:root" in out


def test_graphviz_presenter_build_path_graph() -> None:
    presenter = GraphvizPresenter()
    result = _sample_result()

    dot = presenter.build_path_graph(result, title="Test")

    assert "digraph" in dot
    assert "fw1:root" in dot
    assert "target: 10.0.0.5" in dot
