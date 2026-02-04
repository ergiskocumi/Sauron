"""
Infrastructure Layer - External Service Implementations

Questo package contiene le implementazioni concrete delle interfacce
definite nel domain layer.

- fortigate_client: Client async per FortiOS REST API
"""

from infrastructure.fortigate_client import FortiGateClient

__all__ = [
    "FortiGateClient",
]
