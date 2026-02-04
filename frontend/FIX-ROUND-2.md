# Sauron Frontend - Fix Round 2

## Problemi Risolti (Nuovi)

### 1. React Flow Warning: nodeTypes Recreation

**Problema:**
```
[React Flow]: It looks like you've created a new nodeTypes or edgeTypes object.
If this wasn't on purpose please define the nodeTypes/edgeTypes outside of
the component or memoize them.
```

**Causa:**
Il `nodeTypes` object veniva definito **dentro** il componente, quindi veniva ricreato ad ogni render, causando performance issues e warning.

**Fix:**
Spostato `nodeTypes` **fuori** dal componente `NetworkMap`:

```javascript
// ❌ PRIMA (dentro componente)
export const NetworkMap = () => {
  const nodeTypes = {
    networkNode: NetworkNode,
  };
  // ...
}

// ✅ DOPO (fuori componente)
const nodeTypes = {
  networkNode: NetworkNode,
};

export const NetworkMap = () => {
  // ...
}
```

**File:** `NetworkMap.jsx` (riga 63-66)

---

### 2. TypeError: Cannot read properties of undefined (reading 'includes')

**Problema:**
```
TypeError: Cannot read properties of undefined (reading 'includes')
    at NetworkMap.jsx:135:26
```

**Causa:**
Il backend restituisce `nodes` come **array di stringhe**:
```json
{
  "nodes": ["fw-milano:root", "fw-roma:root"],
  "links": [...]
}
```

Ma il frontend si aspettava oggetti:
```javascript
data.nodes.map(n => ({
  id: n.id,        // ❌ n è string, non ha .id
  label: n.name,   // ❌ n è string, non ha .name
  type: n.type     // ❌ n è string, non ha .type
}))
```

**Fix:**
Parsing corretto delle stringhe node_key:

```javascript
// ✅ DOPO (parsing stringhe)
const initialNodes = data.nodes.map(nodeKey => {
  const parts = nodeKey.split(':');
  const deviceId = parts[0];     // "fw-milano"
  const vdom = parts[1] || 'root'; // "root"

  return {
    id: nodeKey,                 // "fw-milano:root"
    type: 'networkNode',
    data: {
      label: deviceId,           // "fw-milano"
      type: 'firewall',
      subtitle: vdom             // "root"
    }
  };
});
```

**File:** `NetworkMap.jsx` (riga 131-147)

---

### 3. Links/Edges Mapping Fix

**Problema:**
Il backend restituisce link con struttura:
```json
{
  "subnet": "192.168.1.0/24",
  "endpoints": ["fw-milano:root", "fw-roma:root"],
  "interfaces": [...]
}
```

Il frontend cercava `l.source` e `l.target` che non esistevano.

**Fix:**
Creazione edges da `endpoints` array:

```javascript
const initialEdges = [];
data.links.forEach((link, linkIdx) => {
  const endpoints = link.endpoints;

  // Create edges between all pairs of endpoints
  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      initialEdges.push({
        id: `e-${linkIdx}-${i}-${j}`,
        source: endpoints[i],        // ✅ usa endpoints array
        target: endpoints[j],        // ✅ usa endpoints array
        label: link.subnet,
        animated: false,
        style: { strokeWidth: 2, stroke: '#94a3b8' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#94a3b8',
        },
      });
    }
  }
});
```

**File:** `NetworkMap.jsx` (riga 149-168)

---

## Formato Dati Backend → Frontend

### Backend Output (`GET /api/topology`)

```json
{
  "nodes": [
    "fw-milano:root",
    "fw-roma:root"
  ],
  "links": [
    {
      "subnet": "192.168.1.0/24",
      "endpoints": ["fw-milano:root", "fw-roma:root"],
      "is_point_to_point": false,
      "endpoint_count": 2,
      "interfaces": [
        {
          "device_id": "fw-milano",
          "vdom": "root",
          "iface_name": "port1",
          "ip": "192.168.1.1",
          "prefix_len": 24,
          "network_id": "192.168.1.0/24",
          "is_up": true
        }
      ]
    }
  ],
  "node_count": 2,
  "link_count": 1
}
```

### Frontend Transformation (React Flow)

```javascript
// Nodes
{
  id: "fw-milano:root",
  type: "networkNode",
  data: {
    label: "fw-milano",
    type: "firewall",
    subtitle: "root"
  },
  position: { x: 100, y: 100 }  // dagre layout
}

// Edges
{
  id: "e-0-0-1",
  source: "fw-milano:root",
  target: "fw-roma:root",
  label: "192.168.1.0/24",
  animated: false,
  style: { strokeWidth: 2, stroke: '#94a3b8' }
}
```

---

## Checklist Fix

- ✅ `nodeTypes` definito fuori dal componente
- ✅ Parsing corretto delle stringhe node_key
- ✅ Device ID estratto correttamente (`fw-milano`)
- ✅ VDOM estratto correttamente (`root`)
- ✅ Edges creati da `endpoints` array
- ✅ Supporto per subnet con 2+ firewall (mesh topology)

---

## Test da Eseguire

### 1. Verifica Warning Risolto

**Prima del fix:**
```
[React Flow]: It looks like you've created a new nodeTypes object...
```

**Dopo il fix:**
✅ Nessun warning in console

### 2. Verifica Rendering Nodi

**Test:**
1. Esegui scan: `POST /api/scan`
2. Apri Dashboard Map
3. **Aspettato:** Nodi visualizzati con:
   - Label: "fw-milano" (device ID)
   - Subtitle: "root" (VDOM)
   - Icon: Firewall icon
   - Nessun errore "Cannot read properties of undefined"

### 3. Verifica Links

**Test:**
1. Con mappa caricata
2. **Aspettato:** Collegamenti tra firewall con:
   - Label subnet (es. "192.168.1.0/24")
   - Frecce direzionali
   - Linee grigie

---

## File Modificati

**`NetworkMap.jsx`:**
- Riga 63-66: `nodeTypes` spostato fuori componente
- Riga 131-147: Fix parsing nodi da stringhe
- Riga 149-168: Fix creazione edges da endpoints

---

**Stato:** ✅ Pronto per test
**Data Fix:** 2026-02-04 23:55
