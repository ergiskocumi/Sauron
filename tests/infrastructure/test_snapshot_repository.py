"""
Tests for SnapshotRepository.
"""

from datetime import datetime
from pathlib import Path

from application.models.snapshot import NetworkSnapshot
from application.models.topology import Topology
from infrastructure.snapshot_repository import SnapshotRepository


def _snapshot() -> NetworkSnapshot:
    topology = Topology(nodes=set(), links=[], adjacency={}, ip_to_owners={})
    return NetworkSnapshot(
        topology=topology,
        routing_tables={},
        interfaces=[],
        firewalls_metadata=[],
        timestamp=datetime.now(),
    )


def test_load_compressed_snapshot_with_snapshot_extension(tmp_path: Path) -> None:
    repo = SnapshotRepository(compress=True)
    path = tmp_path / "sample.snapshot"

    repo.save(_snapshot(), path, overwrite=True)
    loaded = repo.load(path)

    assert loaded.version == "1.0"
