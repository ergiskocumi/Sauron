"""
Tests for ResolverService.
"""

import pytest

from application.models.snapshot import NetworkSnapshot
from application.models.topology import Topology
from application.services.resolver_service import (
    ResolverService,
    AmbiguousSourceError,
    InvalidTargetError,
    NodeNotFoundError,
)


@pytest.fixture
def snapshot() -> NetworkSnapshot:
    topology = Topology(
        nodes={"fw1:root", "fw1:prod", "fw2:root"},
        links=[],
        adjacency={},
        ip_to_owners={},
    )
    return NetworkSnapshot(
        topology=topology,
        routing_tables={},
        interfaces=[],
        firewalls_metadata=[],
    )


def test_resolve_source_explicit(snapshot: NetworkSnapshot) -> None:
    resolver = ResolverService()
    node = resolver.resolve_source("fw1:root", snapshot)
    assert node.node_key == "fw1:root"


def test_resolve_source_explicit_case_insensitive(snapshot: NetworkSnapshot) -> None:
    resolver = ResolverService()
    node = resolver.resolve_source("FW1:ROOT", snapshot)
    assert node.node_key == "fw1:root"


def test_resolve_source_device_single_vdom(snapshot: NetworkSnapshot) -> None:
    resolver = ResolverService()
    node = resolver.resolve_source("fw2", snapshot)
    assert node.node_key == "fw2:root"


def test_resolve_source_device_default_vdom(snapshot: NetworkSnapshot) -> None:
    resolver = ResolverService(default_vdom="root")
    node = resolver.resolve_source("fw1", snapshot)
    assert node.node_key == "fw1:root"


def test_resolve_source_ambiguous_no_default() -> None:
    topology = Topology(
        nodes={"fw1:prod", "fw1:dev"},
        links=[],
        adjacency={},
        ip_to_owners={},
    )
    snapshot = NetworkSnapshot(
        topology=topology,
        routing_tables={},
        interfaces=[],
        firewalls_metadata=[],
    )

    resolver = ResolverService(default_vdom="root")

    with pytest.raises(AmbiguousSourceError) as exc:
        resolver.resolve_source("fw1", snapshot)

    assert "fw1:dev" in (exc.value.candidates or [])


def test_resolve_source_not_found(snapshot: NetworkSnapshot) -> None:
    resolver = ResolverService()

    with pytest.raises(NodeNotFoundError):
        resolver.resolve_source("missing", snapshot)


def test_resolve_target_ip_valid() -> None:
    resolver = ResolverService()
    assert resolver.resolve_target_ip("10.0.0.1") == "10.0.0.1"


def test_resolve_target_ip_invalid() -> None:
    resolver = ResolverService()

    with pytest.raises(InvalidTargetError):
        resolver.resolve_target_ip("not-an-ip")
