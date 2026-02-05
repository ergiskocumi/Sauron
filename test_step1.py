#!/usr/bin/env python3
"""
Test script for STEP 1: Next-Hop Topology Refactoring

Verifies that the topology builder correctly uses routing tables
to create directed links with metrics instead of full mesh.

Usage:
    python test_step1.py
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from application.services.topology_service import TopologyService
from application.models.topology import InterfaceRecord, Node
from domain.models import Route


def test_next_hop_topology():
    """Test that topology uses next-hop relationships from routing tables."""

    print("=" * 80)
    print("STEP 1 TEST: Next-Hop Topology Refactoring")
    print("=" * 80)

    # Create test interfaces
    interfaces = [
        InterfaceRecord(
            device_id="fw-milano",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.1"),
            prefix_len=24,
            is_up=True,
        ),
        InterfaceRecord(
            device_id="fw-roma",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.2"),
            prefix_len=24,
            is_up=True,
        ),
        InterfaceRecord(
            device_id="fw-napoli",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.3"),
            prefix_len=24,
            is_up=True,
        ),
    ]

    # Create test routing tables
    routing_tables = {
        "fw-milano:root": [
            Route(
                destination="0.0.0.0/0",
                gateway="10.0.0.2",
                interface="port1",
                protocol="ospf",
                subtype=None,
                distance=110,
                metric=10,
            ),
        ],
        "fw-roma:root": [
            Route(
                destination="0.0.0.0/0",
                gateway="10.0.0.3",
                interface="port1",
                protocol="ospf",
                subtype=None,
                distance=110,
                metric=20,
            ),
        ],
        "fw-napoli:root": [
            Route(
                destination="0.0.0.0/0",
                gateway="192.168.1.1",
                interface="wan1",
                protocol="static",
                subtype=None,
                distance=1,
                metric=0,
            ),
        ],
    }

    # Build topology with routing tables
    service = TopologyService()
    print("\n✓ Created TopologyService")

    topology = service.build_topology(interfaces, routing_tables)
    print(f"✓ Built topology with routing tables")

    # Verify results
    print("\n" + "=" * 80)
    print("TEST RESULTS")
    print("=" * 80)

    print(f"\nNodes: {topology.node_count}")
    for node_key in sorted(topology.nodes):
        print(f"  - {node_key}")

    print(f"\nLinks: {topology.link_count}")

    if topology.link_count == 0:
        print("  ⚠️  WARNING: No links created!")
        print("     This may be expected if gateways are not in the topology.")
    else:
        for idx, link in enumerate(topology.links):
            print(f"\n  Link {idx + 1}:")
            print(f"    Source:     {link.source}")
            print(f"    Target:     {link.target}")
            print(f"    Subnet:     {link.subnet}")
            print(f"    Interface:  {link.source_interface}")
            print(f"    Gateway:    {link.target_ip}")
            print(f"    Cost:       {link.cost}")
            print(f"    Protocol:   {link.protocol}")
            print(f"    Distance:   {link.distance}")

    # Test assertions
    print("\n" + "=" * 80)
    print("ASSERTIONS")
    print("=" * 80)

    # 1. Should have 3 nodes
    assert topology.node_count == 3, f"Expected 3 nodes, got {topology.node_count}"
    print("✅ Node count: 3")

    # 2. Should have 2 links (MILANO→ROMA, ROMA→NAPOLI)
    # Note: NAPOLI's gateway (192.168.1.1) is external, so no link created
    assert topology.link_count == 2, f"Expected 2 links, got {topology.link_count}"
    print("✅ Link count: 2 (MILANO→ROMA, ROMA→NAPOLI)")

    # 3. First link should be MILANO → ROMA with cost 10
    link1 = topology.links[0]
    assert link1.source == "fw-milano:root", f"Expected source 'fw-milano:root', got {link1.source}"
    assert link1.target == "fw-roma:root", f"Expected target 'fw-roma:root', got {link1.target}"
    assert link1.cost == 10, f"Expected cost 10, got {link1.cost}"
    assert link1.protocol == "ospf", f"Expected protocol 'ospf', got {link1.protocol}"
    print("✅ Link 1: MILANO → ROMA (cost=10, protocol=ospf)")

    # 4. Second link should be ROMA → NAPOLI with cost 20
    link2 = topology.links[1]
    assert link2.source == "fw-roma:root", f"Expected source 'fw-roma:root', got {link2.source}"
    assert link2.target == "fw-napoli:root", f"Expected target 'fw-napoli:root', got {link2.target}"
    assert link2.cost == 20, f"Expected cost 20, got {link2.cost}"
    assert link2.protocol == "ospf", f"Expected protocol 'ospf', got {link2.protocol}"
    print("✅ Link 2: ROMA → NAPOLI (cost=20, protocol=ospf)")

    # 5. Adjacency should be directed (not bidirectional)
    milano_neighbors = topology.adjacency.get("fw-milano:root", [])
    assert len(milano_neighbors) == 1, f"Expected MILANO to have 1 neighbor, got {len(milano_neighbors)}"
    assert milano_neighbors[0][0] == "fw-roma:root", "MILANO should only have ROMA as neighbor"
    print("✅ Adjacency is directed (MILANO → ROMA only)")

    # 6. Verify backward compatibility: endpoints property
    assert link1.endpoints == {"fw-milano:root", "fw-roma:root"}, "endpoints property should work"
    print("✅ Backward compatibility: endpoints property works")

    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED!")
    print("=" * 80)

    print("\n📊 COMPARISON:")
    print(f"   BEFORE (full mesh): Would create {3 * 2 // 2} = 3 bidirectional links")
    print(f"   AFTER (next-hop):   Created {topology.link_count} directed links")
    print(f"   Reduction:          {3 - topology.link_count} fewer links (more accurate!)")

    return True


def test_legacy_fallback():
    """Test that legacy subnet bucketing still works for backward compatibility."""

    print("\n" + "=" * 80)
    print("LEGACY FALLBACK TEST")
    print("=" * 80)

    # Create test interfaces
    interfaces = [
        InterfaceRecord(
            device_id="fw-milano",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.1"),
            prefix_len=24,
            is_up=True,
        ),
        InterfaceRecord(
            device_id="fw-roma",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.2"),
            prefix_len=24,
            is_up=True,
        ),
    ]

    # Build topology WITHOUT routing tables (legacy mode)
    service = TopologyService()
    topology = service.build_topology(interfaces, routing_tables=None)
    print(f"✓ Built topology without routing tables (legacy mode)")

    print(f"\nLinks created: {topology.link_count}")

    # Should create bidirectional links (2 links: MILANO→ROMA, ROMA→MILANO)
    assert topology.link_count == 2, f"Expected 2 links in legacy mode, got {topology.link_count}"
    print("✅ Legacy mode creates bidirectional links")

    # Check that links have default values
    for link in topology.links:
        assert link.protocol == "connected", "Legacy links should have protocol='connected'"
        assert link.cost == 1, "Legacy links should have cost=1"
        print(f"✅ Link {link.source} → {link.target}: protocol={link.protocol}, cost={link.cost}")

    print("\n✅ LEGACY FALLBACK TEST PASSED!")

    return True


if __name__ == "__main__":
    try:
        # Run tests
        test_next_hop_topology()
        test_legacy_fallback()

        print("\n" + "=" * 80)
        print("🎉 STEP 1 REFACTORING VERIFIED SUCCESSFULLY!")
        print("=" * 80)
        print("\n✅ Next-hop topology building works correctly")
        print("✅ Directed links with metrics are created")
        print("✅ Backward compatibility maintained")
        print("\n📝 Ready for STEP 2: Metric enrichment")
        print("📝 Ready for STEP 3: Dijkstra implementation")

        sys.exit(0)

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
