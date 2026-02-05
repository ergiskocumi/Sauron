# Path Simulation - Integration Guide

## Files Creati

✅ `/src/services/pathService.js` - Service Layer per chiamate API
✅ `/src/hooks/usePath.js` - Custom Hook per gestione stato
✅ `/src/features/topology/PathSimulationPanel.jsx` - UI Component

## Integrazione in NetworkMap.jsx

### STEP 1: Import Necessari

Aggiungi agli import esistenti:

```javascript
import { usePath } from '../../hooks/usePath';
import { PathSimulationPanel } from './PathSimulationPanel';
```

### STEP 2: Stati Aggiuntivi nel Componente

Dopo gli stati esistenti, aggiungi:

```javascript
export const NetworkMap = () => {
  // Stati esistenti
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesState([]);
  // ...

  // NUOVI STATI PER PATH SIMULATION
  const { pathResult, loading: pathLoading, error: pathError, calculatePath, resetPath } = usePath();
  const [originalNodes, setOriginalNodes] = useState([]);
  const [originalEdges, setOriginalEdges] = useState([]);
  const [availableNodes, setAvailableNodes] = useState([]);
```

### STEP 3: Salva Stato Originale in fetchTopology

Nella funzione `fetchTopology`, dopo il layout dei nodi, aggiungi:

```javascript
const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
  initialNodes,
  initialEdges
);

// AGGIUNGI QUESTE RIGHE
setOriginalNodes([...layoutedNodes]);
setOriginalEdges([...layoutedEdges]);
setAvailableNodes(data.nodes); // Lista di node_keys per dropdown

setNodes([...layoutedNodes]);
setEdges([...layoutedEdges]);
```

### STEP 4: Funzioni di Highlighting

Aggiungi queste funzioni nel componente NetworkMap:

```javascript
// Calcola path e applica highlighting
const handleCalculatePath = async (source, destination) => {
  try {
    const result = await calculatePath(source, destination);

    // Highlight nodes
    const highlightedNodes = originalNodes.map(node => {
      const isHighlighted = result.nodeKeys.includes(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          isHighlighted,
        },
        style: isHighlighted
          ? {
              ...node.style,
              border: '3px solid #8b5cf6',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
            }
          : node.style,
      };
    });

    // Highlight edges
    const highlightedEdges = originalEdges.map(edge => {
      const isHighlighted = result.nodeKeys.includes(edge.source) &&
                            result.nodeKeys.includes(edge.target);
      return {
        ...edge,
        animated: isHighlighted,
        style: isHighlighted
          ? { strokeWidth: 3, stroke: '#8b5cf6' }
          : { strokeWidth: 2, stroke: '#94a3b8' },
        markerEnd: isHighlighted
          ? { type: MarkerType.ArrowClosed, color: '#8b5cf6' }
          : { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      };
    });

    setNodes(highlightedNodes);
    setEdges(highlightedEdges);

    return result;
  } catch (error) {
    console.error('Path calculation failed:', error);
    throw error;
  }
};

// Reset highlighting
const handleResetPath = () => {
  setNodes([...originalNodes]);
  setEdges([...originalEdges]);
  resetPath();
};
```

### STEP 5: Aggiungi Path Panel al Render

Nel return del componente, aggiungi il pannello come `<Panel>`:

```jsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  nodeTypes={nodeTypes}
  fitView
  className="bg-slate-50/50"
>
  <Background gap={20} color="#e2e8f0" variant="dots" />
  <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-lg !rounded-xl overflow-hidden" />

  {/* AGGIUNGI QUESTO PANNELLO */}
  <Panel position="top-left" className="!m-4">
    <PathSimulationPanel
      availableNodes={availableNodes}
      onCalculatePath={handleCalculatePath}
      onResetPath={handleResetPath}
      isCalculating={pathLoading}
      pathResult={pathResult}
      pathError={pathError}
    />
  </Panel>

  {/* Altri Panel esistenti... */}
  <Panel position="top-right">
    {/* Refresh button */}
  </Panel>
</ReactFlow>
```

---

## Come Testare

### 1. Backend Deve Essere Avviato

```bash
cd /Users/ergis.kocumi/Sauron
source .venv/bin/activate
uvicorn backend.api:app --reload
```

### 2. Frontend con Hot Reload

```bash
cd /Users/ergis.kocumi/Sauron/frontend
npm run dev
```

### 3. Test Flow

1. ✅ Vai su **Dashboard Map**
2. ✅ Clicca **SCAN NETWORK** (aspetta completamento)
3. ✅ Torna su **Dashboard Map**
4. ✅ In alto a sinistra, clicca il pannello **"Path Simulation"** per espanderlo
5. ✅ Seleziona un nodo sorgente (es. "fw-milano (root)")
6. ✅ Inserisci IP destinazione (es. "8.8.8.8")
7. ✅ Clicca **"Trace Path"**
8. ✅ **Risultato**: Nodi e collegamenti evidenziati in viola/animati!

### Risultati Attesi

#### Percorso Trovato (reached)
- ✅ Nodi attraversati: **bordo viola + glow**
- ✅ Link attraversati: **linea viola animata**
- ✅ Pannello mostra: "✅ Percorso trovato: X hop"

#### Exit WAN (exit_wan)
- ✅ Ultimo nodo evidenziato
- ✅ Link verso gateway evidenziato
- ✅ Pannello mostra: "🌐 Uscita verso WAN via X.X.X.X"

#### Percorso Non Trovato (dropped)
- ✅ Nodo sorgente evidenziato
- ✅ Nessun link animato
- ✅ Pannello mostra: "❌ Pacchetto droppato"

### 4. Reset

- ✅ Clicca bottone **"Reset"**
- ✅ Mappa torna allo stato normale
- ✅ Toast: "Mappa resettata"

---

## Colori Highlighting

| Elemento | Stato Normale | Stato Highlighted |
|----------|---------------|-------------------|
| Node Border | `transparent` | `3px solid #8b5cf6` (purple) |
| Node Shadow | `shadow-2xl` | `0 0 20px rgba(139, 92, 246, 0.5)` |
| Edge Stroke | `#94a3b8` (slate) | `#8b5cf6` (purple) |
| Edge Width | `2px` | `3px` |
| Edge Animated | `false` | `true` |

---

## Troubleshooting

### Errore: "Cannot read property 'nodeKeys'"

**Causa:** pathResult è null prima del calcolo.

**Fix:** Il PathSimulationPanel già gestisce questo caso con `{pathResult && ...}`.

### Errore: "No snapshot available"

**Causa:** Non è stato fatto lo scan.

**Fix:** Clicca **SCAN NETWORK** e aspetta il completamento.

### Nodi/Link non si evidenziano

**Causa:** I node_keys nel pathResult non corrispondono agli ID dei nodi.

**Debug:**
```javascript
console.log('Path nodeKeys:', result.nodeKeys);
console.log('Available nodes:', nodes.map(n => n.id));
```

**Fix:** Verifica che il backend restituisca node_keys nel formato corretto ("device:vdom").

---

## API Endpoint Utilizzato

### POST /api/path

**Request:**
```json
{
  "source": "fw-milano",
  "destination": "8.8.8.8",
  "max_ttl": 64
}
```

**Response:**
```json
{
  "source_node": {
    "device_id": "fw-milano",
    "vdom": "root"
  },
  "target_ip": "8.8.8.8",
  "hops": [
    {
      "node": {
        "device_id": "fw-milano",
        "vdom": "root"
      },
      "egress_interface": "port1",
      "action": "exit_wan",
      "next_hop_ip": "10.0.0.1"
    }
  ],
  "status": "exit_wan"
}
```

---

## Completamento Feature

Dopo l'integrazione, Sauron avrà:

- ✅ **Inventory Management** (visualizzazione firewall)
- ✅ **Network Topology** (mappa grafica con React Flow)
- ✅ **Path Simulation** (tracciamento percorsi con highlighting)

**Sauron v1.0 è completo!** 🎉

---

**Autore:** Claude Sonnet 4.5
**Data:** 2026-02-05
**Versione:** 1.0.0
