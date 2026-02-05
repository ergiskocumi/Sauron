# STEP 2: Link Metrics Enrichment

**Status**: ✅ COMPLETED AND TESTED
**Date**: 2026-02-05
**Objective**: Arricchire i link con metriche avanzate (bandwidth, latency, reliability) per pathfinding ottimizzato

---

## Problem Statement

### Before STEP 2
Dopo STEP 1, i link avevano solo il **costo OSPF/BGP** come metrica:
- ✅ Source → Target (directed)
- ✅ Cost (metric from routing table)
- ✅ Protocol (OSPF, BGP, static, connected)
- ❌ **NO bandwidth information**
- ❌ **NO latency estimation**
- ❌ **NO reliability scoring**

**Limitazione**: Dijkstra (STEP 3) userebbe solo il costo, ignorando:
- Link con **bandwidth maggiore** (preferiti per traffico bulk)
- Link con **latenza minore** (preferiti per traffico real-time)
- Link **meno affidabili** (da evitare se possibile)

---

## Solution: Multi-Metric Link Enrichment

### Metriche Aggiunte

1. **Bandwidth (Mbps)**: Larghezza di banda dell'interfaccia
   - Estratto dal campo `speed` dell'interfaccia FortiGate
   - Formato: "1000full" → 1000 Mbps, "10000full" → 10000 Mbps

2. **Latency (ms)**: Latenza stimata del link
   - Basata sul tipo di interfaccia
   - Physical/VLAN: 0.1ms, Tunnel: 1.0ms, Hard-switch: 0.05ms

3. **Reliability (0.0-1.0)**: Affidabilità del link
   - Basata su stato operativo e tipo interfaccia
   - Physical: 0.99, VLAN: 0.98, Tunnel: 0.95

### Benefici

✅ **Dijkstra multi-costo**: Può pesare costo, bandwidth, latency
✅ **Visual feedback**: Edge width basato su bandwidth (1G → thin, 100G → thick)
✅ **Path quality**: Scegliere percorsi non solo più corti, ma anche più veloci/affidabili
✅ **Capacity planning**: Identificare bottleneck di bandwidth

---

## Files Modified

### 1. `/domain/models.py` - NetworkInterface Enhancement

**Aggiunti campi**:
```python
class NetworkInterface(BaseModel):
    # ... campi esistenti ...

    speed: Optional[str] = Field(
        None,
        description="Velocità interfaccia (es. '1000full', '10000full')"
    )
    link_up_time: Optional[int] = Field(
        None,
        alias="link-up-time",
        description="Tempo da quando il link è up (secondi)"
    )

    @property
    def bandwidth_mbps(self) -> Optional[int]:
        """Estrae bandwidth da speed field (es. '1000full' -> 1000)."""
        if not self.speed:
            return None

        speed_str = self.speed.lower().replace("full", "").replace("half", "").strip()
        if not speed_str or speed_str == "auto":
            return None

        return int(speed_str)
```

**Esempi**:
```python
iface.speed = "1000full"    → bandwidth_mbps = 1000   (1 Gbps)
iface.speed = "10000full"   → bandwidth_mbps = 10000  (10 Gbps)
iface.speed = "100000full"  → bandwidth_mbps = 100000 (100 Gbps)
iface.speed = "auto"        → bandwidth_mbps = None
```

---

### 2. `/application/models/topology.py` - InterfaceRecord Enhancement

**Aggiunti campi**:
```python
class InterfaceRecord(BaseModel):
    # ... campi esistenti ...

    bandwidth_mbps: Optional[int] = Field(
        None,
        description="Bandwidth in Mbps"
    )
    interface_type: Optional[str] = Field(
        None,
        description="Tipo interfaccia (physical, vlan, tunnel)"
    )
```

**Nuove proprietà calcolate**:

#### A. Latency Estimation
```python
@property
def estimated_latency_ms(self) -> float:
    """
    Stima latenza basata su tipo interfaccia.

    - physical: 0.1ms (switching L2)
    - vlan: 0.1ms (tagging overhead minimo)
    - tunnel: 1.0ms (encryption overhead)
    - hard-switch: 0.05ms (hardware switching)
    """
    if not self.interface_type:
        return 0.1

    type_lower = self.interface_type.lower()
    if "tunnel" in type_lower:
        return 1.0
    elif "hard-switch" in type_lower:
        return 0.05
    else:
        return 0.1
```

#### B. Reliability Scoring
```python
@property
def reliability_score(self) -> float:
    """
    Calcola affidabilità (0.0 - 1.0).

    - physical: 0.99 (molto affidabile)
    - vlan: 0.98
    - tunnel: 0.95 (meno affidabile per encryption)
    - is_up=False: 0.0 (non usabile)
    """
    if not self.is_up:
        return 0.0

    type_lower = self.interface_type.lower()
    if "physical" in type_lower:
        return 0.99
    elif "vlan" in type_lower:
        return 0.98
    elif "tunnel" in type_lower:
        return 0.95
    else:
        return 0.95
```

**Factory method aggiornato**:
```python
@classmethod
def from_network_interface(cls, device_id: str, iface: NetworkInterface):
    return cls(
        device_id=device_id,
        vdom=iface.vdom,
        iface_name=iface.name,
        ip=ip_int,
        prefix_len=prefix_len,
        is_up=iface.is_up,
        bandwidth_mbps=iface.bandwidth_mbps,  # ← NEW
        interface_type=iface.type,             # ← NEW
    )
```

---

### 3. `/application/models/topology.py` - Link Model Enhancement

**Aggiunti campi**:
```python
class Link(BaseModel):
    # ... campi esistenti ...

    bandwidth_mbps: Optional[int] = Field(
        None,
        description="Bandwidth dell'interfaccia sorgente in Mbps"
    )
    latency_ms: Optional[float] = Field(
        None,
        description="Latenza stimata del link in millisecondi"
    )
    reliability: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Punteggio di affidabilità (0.0 - 1.0)"
    )
```

**__repr__ migliorato**:
```python
def __repr__(self) -> str:
    metrics = f"cost={self.cost}"
    if self.bandwidth_mbps:
        metrics += f", bw={self.bandwidth_mbps}Mbps"
    if self.latency_ms:
        metrics += f", lat={self.latency_ms:.2f}ms"
    if self.reliability:
        metrics += f", rel={self.reliability:.2f}"
    return f"Link({self.source} -> {self.target} via {self.subnet}, {metrics})"
```

**Output esempio**:
```
Link(fw-milano:root -> fw-roma:root via 10.0.0.0/24, cost=10, bw=10000Mbps, lat=0.10ms, rel=0.99)
```

---

### 4. `/application/services/topology_service.py` - Metric Calculation

**Updated `_extract_links_from_routing_tables()`**:
```python
# Calculate link metrics from source interface
bandwidth_mbps = source_iface.bandwidth_mbps
latency_ms = source_iface.estimated_latency_ms
reliability = source_iface.reliability_score

# Create directed link with enriched metrics
link = Link(
    source=source_node_key,
    target=target_node_key,
    subnet=subnet,
    source_interface=route.interface,
    target_ip=route.gateway,
    cost=route.metric,
    protocol=route.protocol,
    distance=route.distance,
    bandwidth_mbps=bandwidth_mbps,      # ← NEW
    latency_ms=latency_ms,              # ← NEW
    reliability=reliability,            # ← NEW
    interfaces=[source_iface],
)
```

**Log output migliorato**:
```
Link: fw-milano:root -> fw-roma:root via 10.0.0.0/24
      (cost=10, proto=ospf, bw=10000Mbps, lat=0.10ms, rel=0.99)
```

---

### 5. `/backend/api.py` - API Serialization

**Updated topology endpoint**:
```python
links_serialized = []
for link in topology.links:
    links_serialized.append({
        "source": link.source,
        "target": link.target,
        "subnet": link.subnet,
        "source_interface": link.source_interface,
        "target_ip": link.target_ip,
        "cost": link.cost,
        "protocol": link.protocol,
        "distance": link.distance,
        # STEP 2: Metriche avanzate
        "bandwidth_mbps": link.bandwidth_mbps,    # ← NEW
        "latency_ms": link.latency_ms,            # ← NEW
        "reliability": link.reliability,          # ← NEW
        # ...
    })
```

**API Response esempio**:
```json
{
  "links": [
    {
      "source": "fw-milano:root",
      "target": "fw-roma:root",
      "subnet": "10.0.0.0/24",
      "cost": 10,
      "protocol": "ospf",
      "bandwidth_mbps": 10000,
      "latency_ms": 0.1,
      "reliability": 0.99
    }
  ]
}
```

---

### 6. `/frontend/src/features/topology/NetworkMap.jsx` - Visual Metrics

**Edge rendering con metriche**:

#### A. Label con metriche
```javascript
// Build label with metrics (cost, bandwidth, latency)
const costLabel = link.cost > 1 ? ` cost:${link.cost}` : '';
const bwLabel = link.bandwidth_mbps
  ? ` ${link.bandwidth_mbps >= 1000
      ? (link.bandwidth_mbps / 1000) + 'G'
      : link.bandwidth_mbps + 'M'}`
  : '';
const latencyLabel = link.latency_ms
  ? ` ${link.latency_ms.toFixed(2)}ms`
  : '';

const metricsLine = `${costLabel}${bwLabel}${latencyLabel}`.trim();
const label = protocolBadge
  ? `${link.subnet}\n${protocolBadge}\n${metricsLine}`
  : `${link.subnet}\n${metricsLine}`;
```

**Esempio label**:
```
10.0.0.0/24
OSPF
cost:10 10G 0.10ms
```

#### B. Edge width basato su bandwidth
```javascript
let strokeWidth = 2;
if (link.bandwidth_mbps) {
  if (link.bandwidth_mbps >= 100000) strokeWidth = 6;      // 100G+ → thick
  else if (link.bandwidth_mbps >= 40000) strokeWidth = 5;  // 40G
  else if (link.bandwidth_mbps >= 10000) strokeWidth = 4;  // 10G
  else if (link.bandwidth_mbps >= 1000) strokeWidth = 3;   // 1G
  else strokeWidth = 2;                                     // < 1G → thin
}
```

**Visual mapping**:
```
100 Mbps  → ───   (thin, 2px)
1 Gbps    → ════  (medium, 3px)
10 Gbps   → █████ (thick, 4px)
100 Gbps  → ███████ (very thick, 6px)
```

#### C. Opacity basato su reliability
```javascript
style: {
  strokeWidth: strokeWidth,
  stroke: /* protocol color */,
  opacity: link.reliability ? 0.5 + (link.reliability * 0.5) : 1.0
}
```

**Visual mapping**:
```
reliability 0.95 → opacity 0.975 (quasi opaco, affidabile)
reliability 0.80 → opacity 0.90  (leggermente trasparente)
reliability 0.50 → opacity 0.75  (trasparente, poco affidabile)
```

---

## Test Results

```bash
$ python test_step2.py

STEP 2 TEST: Interface Metrics Extraction
✅ Speed '1000full' -> 1000 Mbps
✅ Speed '10000full' -> 10000 Mbps
✅ Speed 'auto' -> None Mbps

STEP 2 TEST: Latency and Reliability Estimation
✅ Type 'physical': latency=0.1ms, reliability=0.99
✅ Type 'vlan': latency=0.1ms, reliability=0.98
✅ Type 'tunnel': latency=1.0ms, reliability=0.95

STEP 2 TEST: Link Metrics Enrichment
✓ Built topology: 2 nodes, 1 links
✅ Bandwidth:   10000 Mbps
✅ Latency:     0.1 ms
✅ Reliability: 0.99

🎉 STEP 2 METRICS ENRICHMENT VERIFIED SUCCESSFULLY!
```

---

## Visual Comparison

### Before STEP 2
```
[FW-A] ──OSPF (cost:10)──> [FW-B]
       └─ Thin gray edge (2px)
       └─ No bandwidth info
       └─ No latency info
```

### After STEP 2
```
[FW-A] ══OSPF══> [FW-B]
       └─ 10.0.0.0/24
       └─ OSPF
       └─ cost:10 10G 0.10ms
       └─ Thick purple edge (4px, 10 Gbps)
       └─ High opacity (0.995, reliability 0.99)
```

---

## Real-World Example

### Scenario: Scegliere tra 2 percorsi

```
Topology:
         ┌──[Link A: 1G, cost=10, lat=0.1ms]──┐
[Source] ┤                                      ├─[Destination]
         └──[Link B: 100M, cost=5, lat=5ms]───┘

BEFORE (solo cost):
  → Sceglie Link B (cost=5 < cost=10)
  ❌ SBAGLIATO: Link B è più lento (100M vs 1G, latenza 5ms vs 0.1ms)

AFTER (multi-metric):
  → Dijkstra può considerare:
    - Link A: cost=10, bw=1000, lat=0.1 → Score composito migliore
    - Link B: cost=5, bw=100, lat=5.0 → Score composito peggiore
  ✅ CORRETTO: Sceglie Link A per bandwidth/latenza migliore
```

---

## Metric Calculation Details

### Bandwidth Extraction

**FortiGate speed field formats**:
```
"1000full"   → 1000 Mbps   (1 Gigabit)
"10000full"  → 10000 Mbps  (10 Gigabit)
"100000full" → 100000 Mbps (100 Gigabit)
"auto"       → None        (Auto-negotiation, non determinabile)
```

### Latency Estimation

**Per tipo interfaccia**:
| Type | Latency | Rationale |
|------|---------|-----------|
| **physical** | 0.1ms | Direct L2 switching |
| **vlan** | 0.1ms | VLAN tagging minimal overhead |
| **tunnel** | 1.0ms | IPsec encryption overhead |
| **hard-switch** | 0.05ms | Hardware ASIC switching |

### Reliability Scoring

**Per tipo e stato**:
| Type | Status | Reliability | Rationale |
|------|--------|-------------|-----------|
| **physical** | UP | 0.99 | Hardware molto affidabile |
| **vlan** | UP | 0.98 | Dipende da physical sottostante |
| **tunnel** | UP | 0.95 | Encryption può fallire |
| **any** | DOWN | 0.0 | Link inutilizzabile |

---

## Integration with STEP 3 (Dijkstra)

STEP 2 abilita Dijkstra a calcolare **composite costs**:

### Formula Weighted Cost
```python
def calculate_composite_cost(link):
    """
    Combina costo, bandwidth, latency, reliability in un singolo peso.

    Pesi configurabili per diversi scenari:
    - Real-time traffic: priorità latenza bassa
    - Bulk transfer: priorità bandwidth alta
    - Critical traffic: priorità reliability alta
    """
    # Normalizza metriche (0-1)
    norm_cost = link.cost / 100  # Assumendo max_cost=100
    norm_bw = 1.0 - (link.bandwidth_mbps / 100000)  # 100G = best
    norm_lat = link.latency_ms / 10  # 10ms = worst
    norm_rel = 1.0 - link.reliability  # 1.0 = best

    # Pesi configurabili
    w_cost = 0.4
    w_bw = 0.3
    w_lat = 0.2
    w_rel = 0.1

    return (w_cost * norm_cost +
            w_bw * norm_bw +
            w_lat * norm_lat +
            w_rel * norm_rel)
```

### Profili di Pathfinding

**Scenario 1: Bulk Data Transfer**
```python
weights = {
    "cost": 0.2,
    "bandwidth": 0.6,  # ← Priorità bandwidth
    "latency": 0.1,
    "reliability": 0.1
}
# Risultato: Sceglie percorsi con link 10G/100G
```

**Scenario 2: VoIP/Real-time**
```python
weights = {
    "cost": 0.1,
    "bandwidth": 0.2,
    "latency": 0.6,    # ← Priorità latenza bassa
    "reliability": 0.1
}
# Risultato: Evita tunnel IPsec, preferisce link diretti
```

**Scenario 3: Mission-Critical**
```python
weights = {
    "cost": 0.2,
    "bandwidth": 0.2,
    "latency": 0.1,
    "reliability": 0.5  # ← Priorità affidabilità
}
# Risultato: Evita link instabili, preferisce physical
```

---

## Limitations and Future Enhancements

### Current Limitations

1. **Static Metrics**: Bandwidth/latency sono stime, non misurazioni real-time
2. **No Utilization**: Non considera traffico corrente sulle interfacce
3. **Simple Reliability**: Basato solo su tipo, non su statistiche errori

### Future Enhancements (Post-STEP 3)

1. **Interface Statistics Collection**:
   ```python
   # FortiGate API endpoint: /monitor/system/interface
   {
     "rx_bytes": 123456789,
     "tx_bytes": 987654321,
     "rx_errors": 0,
     "tx_errors": 0,
     "rx_dropped": 0,
     "utilization": 45  # Percentuale
   }
   ```

2. **Dynamic Reliability**:
   ```python
   reliability = 1.0 - (errors / total_packets)
   # Aggiornato in real-time da statistics
   ```

3. **Congestion Detection**:
   ```python
   if utilization > 80%:
       effective_bandwidth *= 0.5  # Penalizza link congestionati
   ```

4. **Historical Metrics**:
   - Media mobile di latenza (da ping test)
   - Trend di errori/drops
   - Availability SLA (uptime percentage)

---

## Summary

STEP 2 trasforma i link da semplici archi con costo a **connessioni ricche di metriche**:

### Metriche Aggiunte
✅ **Bandwidth** (Mbps) - Da campo `speed` interfaccia
✅ **Latency** (ms) - Stimata da tipo interfaccia
✅ **Reliability** (0-1) - Calcolata da stato e tipo

### Files Modificati
- `domain/models.py` - NetworkInterface con bandwidth parsing
- `application/models/topology.py` - InterfaceRecord e Link con metriche
- `application/services/topology_service.py` - Calcolo metriche
- `backend/api.py` - Serializzazione metriche
- `frontend/src/features/topology/NetworkMap.jsx` - Visual metrics

### Visual Enhancements
- Edge width basato su bandwidth (thin → thick)
- Edge opacity basato su reliability (trasparente → opaco)
- Label con cost, bandwidth, latency

### Impact
- **STEP 3 ready**: Dijkstra può usare composite costs
- **Better pathfinding**: Scelta percorsi ottimizzati per scenario (bulk, real-time, critical)
- **Visual insights**: Identify bottlenecks e link lenti a colpo d'occhio

**Il sistema è ora pronto per STEP 3: Implementazione Dijkstra con pathfinding multi-metric.**

---

**Author**: Claude Sonnet 4.5
**Date**: 2026-02-05
**Status**: ✅ COMPLETED AND TESTED
