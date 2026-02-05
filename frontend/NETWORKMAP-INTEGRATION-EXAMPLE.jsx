/**
 * NETWORKMAP INTEGRATION EXAMPLE
 *
 * Questo file mostra come dovrebbe essere NetworkMap.jsx dopo l'integrazione del Path Simulation.
 * NON sostituisce il file esistente, è solo un riferimento.
 *
 * Copia le parti necessarie nel tuo NetworkMap.jsx esistente.
 */

// ============================================================================
// IMPORTS (Aggiungi questi al tuo file)
// ============================================================================

import { usePath } from '../../hooks/usePath';
import { PathSimulationPanel } from './PathSimulationPanel';

// ============================================================================
// STATI NEL COMPONENTE (Aggiungi dopo gli stati esistenti)
// ============================================================================

export const NetworkMap = () => {
  // ... stati esistenti ...

  // Path simulation state
  const { pathResult, loading: pathLoading, error: pathError, calculatePath, resetPath } = usePath();
  const [originalNodes, setOriginalNodes] = useState([]);
  const [originalEdges, setOriginalEdges] = useState([]);
  const [availableNodes, setAvailableNodes] = useState([]);

  // ... resto del codice ...
}

// ============================================================================
// MODIFICA fetchTopology (Salva stato originale)
// ============================================================================

const fetchTopology = useCallback(async (isInitial = false) => {
  try {
    // ... codice esistente ...

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      initialEdges
    );

    // ✨ AGGIUNGI QUESTE 3 RIGHE
    setOriginalNodes([...layoutedNodes]);
    setOriginalEdges([...layoutedEdges]);
    setAvailableNodes(data.nodes);

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
    // ... resto del codice ...
  } catch (error) {
    // ...
  }
}, [setNodes, setEdges]);

// ============================================================================
// NUOVE FUNZIONI (Aggiungi queste due funzioni nel componente)
// ============================================================================

/**
 * Calcola path e applica highlighting ai nodi e link
 */
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
              border: '3px solid #8b5cf6',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)',
            }
          : undefined,
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

/**
 * Reset highlighting e torna alla vista normale
 */
const handleResetPath = () => {
  setNodes([...originalNodes]);
  setEdges([...originalEdges]);
  resetPath();
};

// ============================================================================
// RENDER (Aggiungi il PathSimulationPanel)
// ============================================================================

return (
  <div className="w-full bg-white overflow-hidden relative group" style={{ height: '100%' }}>
    {/* Error state if no snapshot */}
    {error && !isLoading ? (
      // ... existing error UI ...
    ) : null}

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

      {/* ✨ AGGIUNGI QUESTO PANNELLO */}
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

      {/* Existing refresh panel */}
      <Panel position="top-right">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fetchTopology()}
            disabled={isLoading}
            className="px-4 py-2.5 bg-white border border-slate-200 shadow-xl rounded-2xl flex items-center gap-2 hover:bg-slate-50 transition-all text-slate-700 font-bold text-xs uppercase tracking-wider"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Map
          </button>
        </div>
      </Panel>

      {/* Existing legend panel */}
      <Panel position="bottom-left">
        {/* ... existing legend ... */}
      </Panel>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
          {/* ... existing loading UI ... */}
        </div>
      )}
    </ReactFlow>
  </div>
);

// ============================================================================
// FINE ESEMPIO
// ============================================================================
