"""
Infrastructure Layer - External Service Implementations

Questo package contiene le implementazioni concrete delle interfacce
definite nel domain layer.

- fortigate_client: Client async per FortiOS REST API
- snapshot_repository: Persistenza snapshot di rete
"""

from infrastructure.fortigate_client import FortiGateClient
from infrastructure.snapshot_repository import (
    SnapshotRepository,
    SnapshotRepositoryError,
    SnapshotNotFoundError,
    SnapshotCorruptedError,
    SnapshotVersionError,
)

__all__ = [
    "FortiGateClient",
    "SnapshotRepository",
    "SnapshotRepositoryError",
    "SnapshotNotFoundError",
    "SnapshotCorruptedError",
    "SnapshotVersionError",
]
