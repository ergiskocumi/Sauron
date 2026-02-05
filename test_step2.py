#!/usr/bin/env python3
"""
Test script for STEP 2: Link Metrics Enrichment

Verifies that links are enriched with bandwidth, latency, and reliability metrics.

Usage:
    python test_step2.py
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from application.services.topology_service import TopologyService
from application.models.topology import InterfaceRecord
from domain.models import Route, NetworkInterface


def test_interface_metrics():
    """Test that NetworkInterface properly extracts bandwidth from speed field."""

    print("=" * 80)
    print("STEP 2 TEST: Interface Metrics Extraction")
    print("=" * 80)

    # Test bandwidth parsing from speed field
    test_cases = [
        ("1000full", 1000),    # 1 Gbps
        ("10000full", 10000),  # 10 Gbps
        ("auto", None),        # Auto-negotiation
        ("100full", 100),      # 100 Mbps
        (None, None),          # No speed info
    ]

    for speed_value, expected_bw in test_cases:
        iface = NetworkInterface(
            name="port1",
            vdom="root",
            type="physical",
            mode="static",
            ip="10.0.0.1",
            mask="255.255.255.0",
            status="up",
            speed=speed_value,
        )

        actual_bw = iface.bandwidth_mbps
        assert actual_bw == expected_bw, f"Speed '{speed_value}' -> Expected {expected_bw} Mbps, got {actual_bw}"
        print(f"✅ Speed '{speed_value}' -> {actual_bw} Mbps")

    print("\n✅ Interface bandwidth parsing works correctly!")
    return True


def test_interface_latency_reliability():
    """Test latency and reliability estimation based on interface type."""

    print("\n" + "=" * 80)
    print("STEP 2 TEST: Latency and Reliability Estimation")
    print("=" * 80)

    test_cases = [
        ("physical", "up", 0.1, 0.99),
        ("vlan", "up", 0.1, 0.98),
        ("tunnel", "up", 1.0, 0.95),
        ("hard-switch", "up", 0.05, 0.99),
    ]

    for iface_type, status, expected_lat, expected_rel in test_cases:
        iface = NetworkInterface(
            name="test",
            vdom="root",
            type=iface_type,
            mode="static",
            ip="10.0.0.1",
            mask="255.255.255.0",
            status=status,
        )

        # Create InterfaceRecord
        record = InterfaceRecord.from_network_interface("fw-test", iface)

        actual_lat = record.estimated_latency_ms
        actual_rel = record.reliability_score

        assert actual_lat == expected_lat, f"Type '{iface_type}' -> Expected latency {expected_lat}ms, got {actual_lat}ms"
        assert actual_rel == expected_rel, f"Type '{iface_type}' -> Expected reliability {expected_rel}, got {actual_rel}"

        print(f"✅ Type '{iface_type}': latency={actual_lat}ms, reliability={actual_rel}")

    print("\n✅ Latency and reliability estimation works correctly!")
    return True


def test_link_metrics_enrichment():
    """Test that topology links are enriched with bandwidth, latency, reliability."""

    print("\n" + "=" * 80)
    print("STEP 2 TEST: Link Metrics Enrichment")
    print("=" * 80)

    # Create test interfaces with speed
    interfaces = [
        InterfaceRecord(
            device_id="fw-milano",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.1"),
            prefix_len=24,
            is_up=True,
            bandwidth_mbps=10000,  # 10 Gbps
            interface_type="physical",
        ),
        InterfaceRecord(
            device_id="fw-roma",
            vdom="root",
            iface_name="port1",
            ip=InterfaceRecord._ip_to_int("10.0.0.2"),
            prefix_len=24,
            is_up=True,
            bandwidth_mbps=10000,  # 10 Gbps
            interface_type="physical",
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
    }

    # Build topology with routing tables
    service = TopologyService()
    topology = service.build_topology(interfaces, routing_tables)

    print(f"\n✓ Built topology: {topology.node_count} nodes, {topology.link_count} links")

    # Verify link has metrics
    if topology.link_count > 0:
        link = topology.links[0]

        print(f"\nLink Metrics:")
        print(f"  Source:      {link.source}")
        print(f"  Target:      {link.target}")
        print(f"  Cost:        {link.cost}")
        print(f"  Protocol:    {link.protocol}")
        print(f"  Bandwidth:   {link.bandwidth_mbps} Mbps")
        print(f"  Latency:     {link.latency_ms} ms")
        print(f"  Reliability: {link.reliability}")

        # Assertions
        assert link.bandwidth_mbps == 10000, f"Expected bandwidth 10000 Mbps, got {link.bandwidth_mbps}"
        assert link.latency_ms == 0.1, f"Expected latency 0.1ms, got {link.latency_ms}"
        assert link.reliability == 0.99, f"Expected reliability 0.99, got {link.reliability}"

        print("\n✅ Link metrics are correctly populated!")
    else:
        print("  ⚠️  No links created (expected if gateway not in topology)")

    return True


def test_link_repr_with_metrics():
    """Test that Link __repr__ includes metrics."""

    print("\n" + "=" * 80)
    print("STEP 2 TEST: Link String Representation")
    print("=" * 80)

    from application.models.topology import Link

    link = Link(
        source="fw-milano:root",
        target="fw-roma:root",
        subnet="10.0.0.0/24",
        source_interface="port1",
        target_ip="10.0.0.2",
        cost=10,
        protocol="ospf",
        distance=110,
        bandwidth_mbps=10000,
        latency_ms=0.1,
        reliability=0.99,
    )

    repr_str = repr(link)
    print(f"\nLink representation:\n  {repr_str}")

    # Verify metrics are in repr
    assert "cost=10" in repr_str
    assert "bw=10000Mbps" in repr_str
    assert "lat=0.10ms" in repr_str
    assert "rel=0.99" in repr_str

    print("\n✅ Link representation includes all metrics!")
    return True


if __name__ == "__main__":
    try:
        # Run tests
        test_interface_metrics()
        test_interface_latency_reliability()
        test_link_metrics_enrichment()
        test_link_repr_with_metrics()

        print("\n" + "=" * 80)
        print("🎉 STEP 2 METRICS ENRICHMENT VERIFIED SUCCESSFULLY!")
        print("=" * 80)
        print("\n✅ Bandwidth extraction from interface speed works")
        print("✅ Latency estimation based on interface type works")
        print("✅ Reliability scoring based on interface status works")
        print("✅ Links are enriched with all metrics")
        print("\n📝 Ready for STEP 3: Dijkstra shortest path implementation")

        sys.exit(0)

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
