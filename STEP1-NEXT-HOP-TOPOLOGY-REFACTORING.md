# STEP 1: Next-Hop Based Topology Refactoring

**Status**: ✅ COMPLETED
**Date**: 2026-02-05
**Objective**: Fix topology building to use next-hop relationships from routing tables instead of subnet bucketing (full mesh)

---

## Problem Statement

### Before (LEGACY)
The topology builder used **subnet bucketing** which created a **full mesh** between all nodes sharing the same subnet.

**Example Problem**:
```
Subnet 10.0.0.0/24 has 3 firewalls:
- FW-A (10.0.0.1)
- FW-B (10.0.0.2)
- FW-C (10.0.0.3)

OLD BEHAVIOR (WRONG):
FW-A <---> FW-B
FW-A <---> FW-C
FW-B <---> FW-C

This creates 3 links where in reality:
- FW-A only routes to FW-B (next-hop 10.0.0.2)
- FW-B routes to FW-C (next-hop 10.0.0.3)

CORRECT BEHAVIOR (NEW):
FW-A ---> FW-B ---> FW-C
```

### Key Issues
1. **Unrealistic topology**: Nodes appeared directly connected when traffic actually routes through intermediaries
2. **No metrics**: Links had no cost/distance information
3. **No protocol info**: Could not distinguish OSPF, BGP, static, or connected routes
4. **Wrong for pathfinding**: Dijkstra cannot work without link costs

---

## Solution Architecture

### New Approach: Next-Hop Relationships

The refactored topology uses **routing tables** to discover actual next-hop relationships:

```python
For each route in routing_table[node]:
    if route.gateway != "0.0.0.0":
        target_node = find_node_by_ip(route.gateway)
        if target_node:
            create_link(
                source=node,
                target=target_node,
                cost=route.metric,
                protocol=route.protocol
            )
```

### Benefits
✅ **Accurate topology**: Only nodes that actually see each other as next-hop are connected
✅ **Directed graph**: Links have explicit source → target direction
✅ **Metrics included**: Each link has cost, protocol, and administrative distance
✅ **Ready for Dijkstra**: Link costs enable shortest path calculation
✅ **Protocol awareness**: Can distinguish OSPF (purple), BGP (cyan), static (orange), connected (gray)

---

## Files Modified

### 1. `/application/models/topology.py`

**Link Model - Before**:
```python
class Link(BaseModel):
    subnet: str
    endpoints: Set[str]  # Multiple nodes (full mesh)
    interfaces: List[InterfaceRecord]
```

**Link Model - After**:
```python
class Link(BaseModel):
    source: str              # Source node (NEW)
    target: str              # Target node (next-hop) (NEW)
    subnet: str
    source_interface: str    # Egress interface (NEW)
    target_ip: str          # Gateway IP (NEW)
    cost: int               # Route metric (NEW)
    protocol: str           # ospf, bgp, static, connected (NEW)
    distance: int           # Administrative Distance (NEW)

    # Backward compatibility
    @property
    def endpoints(self) -> Set[str]:
        return {self.source, self.target}

    interfaces: List[InterfaceRecord]  # Kept for compatibility
```

**Key Changes**:
- Link is now **directed** (source → target)
- Added **metrics** (cost, protocol, distance)
- Maintained **backward compatibility** with old code via `endpoints` property

---

### 2. `/application/services/topology_service.py`

#### A. Updated `build_topology()` Signature

**Before**:
```python
def build_topology(
    self,
    interfaces: List[InterfaceRecord],
) -> Topology:
```

**After**:
```python
def build_topology(
    self,
    interfaces: List[InterfaceRecord],
    routing_tables: Optional[Dict[str, List[Any]]] = None,  # NEW PARAM
) -> Topology:
```

**Behavior**:
- If `routing_tables` is provided → use **next-hop based** algorithm (PREFERRED)
- If `routing_tables` is None → fallback to **legacy subnet bucketing** (for backward compatibility)

#### B. New Method: `_extract_links_from_routing_tables()`

```python
def _extract_links_from_routing_tables(
    self,
    routing_tables: Dict[str, List[Any]],
    interfaces: List[InterfaceRecord],
    ip_to_owners: Dict[int, List[Tuple[str, int]]],
) -> List[Link]:
```

**Algorithm**:
1. For each node, iterate through its routes
2. For routes with gateway != "0.0.0.0":
   - Lookup the target node by gateway IP
   - Find the source interface for this route
   - Create a directed link with metrics
3. Deduplicate links (same source, target, subnet)

**Example**:
```python
Route: destination=0.0.0.0/0, gateway=10.0.0.1, interface=port1, metric=10, protocol=ospf

→ Creates Link:
   source="fw-milano:root"
   target="fw-roma:root"  (owner of 10.0.0.1)
   subnet="10.0.0.0/24"
   cost=10
   protocol="ospf"
```

#### C. Renamed Legacy Method

- `_extract_links()` → `_extract_links_legacy()`
- Now creates bidirectional links to maintain backward compatibility
- Logs warning: "Using LEGACY SUBNET BUCKETING (full mesh)"

#### D. Updated `_build_adjacency_list()`

**Before** (undirected):
```python
for link in links:
    endpoints = list(link.endpoints)
    for node_a, node_b in pairs(endpoints):
        adjacency[node_a].append((node_b, link_idx))
        adjacency[node_b].append((node_a, link_idx))  # Bidirectional
```

**After** (directed):
```python
for link in links:
    adjacency[link.source].append((link.target, link_idx))  # Only source → target
```

#### E. Updated `build_from_firewalls()`

```python
# Pass routing_tables to build_topology
topology = self.build_topology(all_interfaces, routing_tables)
```

---

### 3. `/backend/api.py`

**Updated Topology Endpoint Serialization**:

```python
# Serializza link con next-hop relationships e metriche
links_serialized = []
for link in topology.links:
    links_serialized.append({
        "source": link.source,              # NEW
        "target": link.target,              # NEW
        "subnet": link.subnet,
        "source_interface": link.source_interface,  # NEW
        "target_ip": link.target_ip,        # NEW
        "cost": link.cost,                  # NEW
        "protocol": link.protocol,          # NEW
        "distance": link.distance,          # NEW
        "is_point_to_point": link.is_point_to_point,
        # Backward compatibility
        "endpoints": list(link.endpoints),
        "endpoint_count": link.endpoint_count,
        "interfaces": [...],
    })
```

**API Response Example**:
```json
{
  "nodes": ["fw-milano:root", "fw-roma:root"],
  "links": [
    {
      "source": "fw-milano:root",
      "target": "fw-roma:root",
      "subnet": "10.0.0.0/24",
      "source_interface": "port1",
      "target_ip": "10.0.0.2",
      "cost": 10,
      "protocol": "ospf",
      "distance": 110
    }
  ]
}
```

---

### 4. `/frontend/src/features/topology/NetworkMap.jsx`

**Edge Creation - Before** (full mesh):
```javascript
// Create edges between ALL pairs of endpoints in subnet
const initialEdges = [];
data.links.forEach((link) => {
  const endpoints = link.endpoints;
  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      initialEdges.push({
        id: `e-${i}-${j}`,
        source: endpoints[i],
        target: endpoints[j],
        label: link.subnet,
        // ...
      });
    }
  }
});
```

**Edge Creation - After** (directed):
```javascript
// Each link is now a DIRECT edge source -> target
const initialEdges = data.links.map((link, linkIdx) => {
  // Build label with cost and protocol
  const costLabel = link.cost > 1 ? ` (cost: ${link.cost})` : '';
  const protocolBadge = link.protocol !== 'connected' ? `${link.protocol}` : '';
  const label = protocolBadge
    ? `${link.subnet}\n${protocolBadge}${costLabel}`
    : `${link.subnet}${costLabel}`;

  return {
    id: `e-${linkIdx}`,
    source: link.source,        // Direct from API
    target: link.target,        // Direct from API
    label: label,
    style: {
      strokeWidth: 2,
      stroke: link.protocol === 'ospf' ? '#8b5cf6' :   // Purple
              link.protocol === 'bgp' ? '#06b6d4' :    // Cyan
              link.protocol === 'static' ? '#f59e0b' : // Orange
              '#cbd5e1'                                // Gray (connected)
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: /* same as stroke */
    },
    data: {
      cost: link.cost,
      protocol: link.protocol,
      distance: link.distance,
      source_interface: link.source_interface,
      target_ip: link.target_ip,
    }
  };
});
```

**Visual Changes**:
- Edges now show **protocol colors**: OSPF (purple), BGP (cyan), static (orange), connected (gray)
- Edge labels show **cost** when > 1
- Edge labels show **protocol** when not "connected"
- Directed arrows point from source to target

---

## Testing Guide

### 1. Backend Test

```bash
cd /Users/ergis.kocumi/Sauron
source .venv/bin/activate
uvicorn backend.api:app --reload
```

**Test Scan**:
```bash
curl -X POST http://localhost:8000/api/scan
```

**Test Topology**:
```bash
curl http://localhost:8000/api/topology | jq '.links[0]'
```

**Expected Output**:
```json
{
  "source": "fw-milano:root",
  "target": "fw-roma:root",
  "subnet": "10.0.0.0/24",
  "cost": 10,
  "protocol": "ospf",
  "distance": 110
}
```

### 2. Frontend Test

```bash
cd /Users/ergis.kocumi/Sauron/frontend
npm run dev
```

**Test Flow**:
1. ✅ Open http://localhost:5173
2. ✅ Click "SCAN NETWORK" and wait for completion
3. ✅ Navigate to "Dashboard Map"
4. ✅ Verify edges are **directed** (arrows point in one direction)
5. ✅ Verify edge **colors** match protocols (purple = OSPF, etc.)
6. ✅ Hover over edges to see **cost** and **protocol** in labels
7. ✅ Verify no full mesh (only next-hop connections visible)

### 3. Path Simulation Test

The path simulation should now work correctly because:
- Links are directed
- Costs are available for Dijkstra (STEP 3)
- Topology reflects actual routing

---

## Backward Compatibility

The refactoring maintains **full backward compatibility**:

### Link Model
- Old code accessing `link.endpoints` still works (returns `{source, target}`)
- Old code accessing `link.interfaces` still works (kept for compatibility)
- Old code accessing `link.subnet` still works (unchanged)

### API Response
- `endpoints` and `endpoint_count` fields still present in JSON
- Old frontend code can still work (but should migrate to source/target)

### Topology Service
- If `routing_tables` is not provided, falls back to legacy algorithm
- Logs warning to encourage migration

---

## Performance Impact

### Before (Subnet Bucketing)
- Time Complexity: O(N × E²) where N = subnets, E = endpoints per subnet
- Space Complexity: O(N × E²) for full mesh links
- Example: 3 nodes on subnet → 3 links (A-B, A-C, B-C)

### After (Next-Hop Routing)
- Time Complexity: O(R + I) where R = routes, I = interfaces
- Space Complexity: O(R) for directed links
- Example: 3 nodes with routing → 2 links (A→B, B→C)

**Result**: Faster and more memory-efficient

---

## What's Next

STEP 1 is now **COMPLETED**. The topology correctly reflects next-hop relationships with metrics.

**Next Steps**:
- **STEP 2**: Verify and enrich link metrics (bandwidth, latency, reliability)
- **STEP 3**: Implement Dijkstra shortest path algorithm using link costs

---

## Troubleshooting

### Issue: "No links created"

**Cause**: Routing tables have no routes with gateways.

**Debug**:
```python
logger.debug(f"Routes: {routing_tables}")
# Check if routes have gateway != "0.0.0.0"
```

**Fix**: Verify routing tables are collected correctly in `build_from_firewalls()`.

---

### Issue: "Gateway not found in topology"

**Cause**: Gateway IP doesn't match any interface IP in the topology.

**Debug**:
```python
logger.debug(f"Gateway {route.gateway} not found in ip_to_owners")
logger.debug(f"Available IPs: {list(ip_to_owners.keys())}")
```

**Fix**:
- Check interface collection includes all IPs
- Verify gateway IPs are reachable interfaces (not external)

---

### Issue: "Frontend shows no edges"

**Cause**: Frontend still uses old `endpoints` array format.

**Fix**: Update NetworkMap.jsx to use `link.source` and `link.target` directly (already done).

---

## Summary

STEP 1 successfully refactored the topology building from **subnet bucketing** (full mesh) to **next-hop based routing** (directed graph).

### Key Achievements
✅ Links now use **source → target** direction
✅ Links include **cost, protocol, distance** metrics
✅ Topology reflects **actual routing tables**
✅ **Backward compatible** with old code
✅ Frontend shows **protocol-colored** edges
✅ Ready for **Dijkstra implementation** (STEP 3)

### Files Changed
- `application/models/topology.py` - Link model with metrics
- `application/services/topology_service.py` - Next-hop algorithm
- `backend/api.py` - API serialization
- `frontend/src/features/topology/NetworkMap.jsx` - Directed edge rendering

**The system is now ready for STEP 2 and STEP 3 to achieve a fully performant pathfinding system.**

---

**Author**: Claude Sonnet 4.5
**Date**: 2026-02-05
