"""
SCAN SERVICE - Orchestrazione scansione rete

Estrae la logica di scansione da api.py in un servizio dedicato.
Responsabilità: load inventory, connect, build topology, save snapshot.
"""

import asyncio
import logging
from pathlib import Path
from typing import List, Tuple

from core.inventory import InventoryLoader
from domain.models import FirewallConfig
from infrastructure.fortigate_client import FortiGateClient
from infrastructure.snapshot_repository import SnapshotRepository
from application.services.topology_service import TopologyService
from application.models.snapshot import NetworkSnapshot, FirewallMetadata

logger = logging.getLogger(__name__)


class ScanService:
    """Orchestrazione completa della scansione di rete."""

    def __init__(
        self,
        inventory_path: str = "inventory.json",
        snapshot_path: Path = Path("network.snapshot.gz"),
        snapshot_repository: SnapshotRepository = None,
    ):
        self.inventory_path = inventory_path
        self.snapshot_path = snapshot_path
        self.snapshot_repository = snapshot_repository or SnapshotRepository(compress=True)

    async def execute(self) -> NetworkSnapshot:
        """
        Esegue la scansione completa della rete.

        Returns:
            NetworkSnapshot salvato su disco

        Raises:
            Exception: Se la scansione fallisce
        """
        logger.info("Scan started")

        configs = self._load_inventory()
        enabled_configs = [cfg for cfg in configs if cfg.enabled]
        logger.info(f"Scanning {len(enabled_configs)} enabled firewalls")

        clients = await self._connect_clients(enabled_configs)

        try:
            topology, routing_tables = await self._build_topology(clients)
            snapshot = self._create_snapshot(
                topology, routing_tables, enabled_configs
            )
            self._save_snapshot(snapshot)
            logger.info(
                f"Scan completed: "
                f"{snapshot.total_nodes} nodes, {snapshot.total_links} links"
            )
            return snapshot
        finally:
            await self._disconnect_clients(clients)

    def _load_inventory(self) -> List[FirewallConfig]:
        loader = InventoryLoader(self.inventory_path)
        return loader.load()

    async def _connect_clients(
        self, configs: List[FirewallConfig]
    ) -> List[Tuple[str, FortiGateClient]]:
        clients = []
        for config in configs:
            client = FortiGateClient(
                ip_address=config.host,
                api_token=config.token,
            )
            await client.connect()
            clients.append((config.id, client))
        return clients

    async def _build_topology(self, clients):
        topology_service = TopologyService()
        return await topology_service.build_from_firewalls(clients)

    def _create_snapshot(self, topology, routing_tables, enabled_configs):
        all_interfaces = list(topology.interfaces)
        if not all_interfaces:
            # Backward compatibility con topologie legacy.
            for link in topology.links:
                all_interfaces.extend(link.interfaces)

        firewalls_metadata = []
        for config in enabled_configs:
            node_keys = [
                node_key for node_key in topology.nodes
                if node_key.startswith(f"{config.id}:")
            ]
            vdoms = [key.split(":", 1)[1] for key in node_keys]

            routes_count = sum(
                len(routing_tables.get(node_key, []))
                for node_key in node_keys
            )

            interfaces_count = sum(
                1 for iface in all_interfaces
                if iface.device_id == config.id
            )

            firewalls_metadata.append(
                FirewallMetadata(
                    device_id=config.id,
                    host=config.host,
                    vdoms=vdoms,
                    routes_count=routes_count,
                    interfaces_count=interfaces_count,
                    scan_success=True,
                )
            )

        return NetworkSnapshot(
            topology=topology,
            routing_tables=routing_tables,
            interfaces=all_interfaces,
            firewalls_metadata=firewalls_metadata,
        )

    def _save_snapshot(self, snapshot: NetworkSnapshot):
        self.snapshot_repository.save(
            snapshot, self.snapshot_path, overwrite=True
        )

    async def _disconnect_clients(self, clients):
        disconnects = [client.disconnect() for _, client in clients]
        await asyncio.gather(*disconnects, return_exceptions=True)
