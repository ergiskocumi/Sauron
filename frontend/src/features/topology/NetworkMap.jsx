import React, { useCallback, useEffect, useState, useMemo, memo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  getBezierPath,
  EdgeLabelRenderer,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import {
  FirewallIcon,
  RouterIcon,
  SwitchIcon,
  HostIcon,
  CloudIcon
} from './Icons';
import { Shield, RefreshCw, Layers, MousePointer2, Target, Zap, X, Info, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { usePath } from '../../hooks/usePath';
import { formatNodesForDropdown } from '../../services/pathService';
import { PathSimulationPanel } from './PathSimulationPanel';

// Configuration Constants (Moved outside to prevent re-renders)
const FIT_VIEW_OPTIONS = { padding: 0.2 };
const PRO_OPTIONS = { hideAttribution: true };

// Protocol Color Mapping
const PROTOCOL_COLORS = {
  ospf: { border: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9' },
  bgp: { border: '#06b6d4', bg: '#ecfeff', text: '#0e7490' },
  static: { border: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  connected: { border: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
  default: { border: '#64748b', bg: '#f8fafc', text: '#334155' },
};

// Custom Node Component (Memoized for performance)
const NetworkNode = memo(({ data, selected }) => {
  const Icon = useMemo(() => {
    switch (data.type) {
      case 'firewall': return FirewallIcon;
      case 'network': return CloudIcon;
      case 'vlan': return SwitchIcon;
      default: return HostIcon;
    }
  }, [data.type]);

  const colors = useMemo(() => {
    switch (data.type) {
      case 'firewall': return { border: 'border-blue-200', bg: 'bg-blue-50/30', text: 'text-blue-700', iconBg: 'bg-blue-100/50' };
      case 'vlan': return { border: 'border-sky-200', bg: 'bg-sky-50/30', text: 'text-sky-800', iconBg: 'bg-sky-100/50' };
      default: return { border: 'border-slate-200', bg: 'bg-slate-50/30', text: 'text-slate-600', iconBg: 'bg-slate-100/50' };
    }
  }, [data.type]);

  // Path visualization: determine node role in path
  const isPathStart = data.isPathStart;
  const isPathEnd = data.isPathEnd;
  const isPathNode = data.isHighlighted;
  const hopIndex = data.hopIndex;
  const pathActive = data.pathActive;

  // Determine node styling based on path role
  const nodeStyle = useMemo(() => {
    if (isPathStart) {
      return 'bg-green-50/50 border-green-500 scale-110 shadow-2xl shadow-green-500/20 z-20';
    }
    if (isPathEnd) {
      return 'bg-orange-50/50 border-orange-500 scale-110 shadow-2xl shadow-orange-500/20 z-20';
    }
    if (isPathNode) {
      return 'bg-blue-50/50 border-blue-500 scale-105 shadow-xl shadow-blue-500/20 z-20';
    }
    if (data.isSource) {
      return 'bg-green-50/50 border-green-500 scale-105 shadow-xl z-20';
    }
    if (pathActive) {
      // Dim non-path nodes when path is active
      return cn('bg-white/40 border-slate-100 opacity-30 blur-[0.5px]', colors.border);
    }
    if (selected) {
      return 'bg-white border-blue-400 ring-4 ring-blue-50 scale-105 shadow-md';
    }
    return cn('bg-white hover:border-blue-300 hover:shadow-md', colors.border);
  }, [isPathStart, isPathEnd, isPathNode, data.isSource, pathActive, selected, colors.border]);

  const isHighlightedNode = isPathStart || isPathEnd || isPathNode || data.isSource;

  return (
    <div className={cn(
      "px-3 py-2 rounded-2xl border flex flex-col items-center min-w-[110px] group relative shadow-sm",
      // Performance: specifico solo le transizioni necessarie. 
      // La posizione è gestita da React Flow (transform), NON dobbiamo transizionarla o avremo lag.
      "transition-[border-color,background-color,box-shadow,opacity] duration-300",
      nodeStyle
    )}>
      {/* START / END Label Badge */}
      {isPathStart && (
        <motion.div
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg z-30 whitespace-nowrap"
        >
          🚀 SOURCE
        </motion.div>
      )}
      {isPathEnd && (
        <motion.div
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg z-30 whitespace-nowrap"
        >
          🎯 DESTINATION
        </motion.div>
      )}

      {/* Hop Number Badge */}
      {hopIndex !== undefined && hopIndex !== null && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            "absolute -top-3 -right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-30 text-[10px] font-black",
            isPathStart
              ? "bg-green-500 text-white"
              : isPathEnd
                ? "bg-orange-500 text-white"
                : "bg-blue-500 text-white"
          )}
        >
          {hopIndex}
        </motion.div>
      )}

      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-slate-200 !border-none !-top-0.5" />

      {/* Icon Wrapper sempre bianco per visibilità icone */}
      <div className={cn(
        "mb-2 p-2 rounded-xl transition-all duration-500 group-hover:scale-110",
        isPathStart ? "bg-green-100/50 shadow-sm" : 
        isPathEnd ? "bg-orange-100/50 shadow-sm" :
        isPathNode ? "bg-blue-100/50 shadow-sm" : colors.iconBg
      )}>
        <div className="scale-[0.85] origin-center">
          <Icon />
        </div>
      </div>

      {/* Testo sempre leggibile (Scurito) */}
      <div className="text-center w-full">
        <div className={cn(
          "font-black text-[10px] tracking-tight truncate leading-tight",
          isHighlightedNode ? "text-slate-900" : "text-slate-800"
        )}>
          {data.label}
        </div>
        <div className={cn(
          "text-[8px] font-bold font-mono uppercase tracking-[0.05em] mt-0.5 opacity-80",
          isHighlightedNode ? "text-blue-600" : "text-slate-400"
        )}>
          {data.subtitle}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-slate-200 !border-none !-bottom-0.5" />
    </div>
  );
});

// Custom Edge Component (Memoized for high performance)
const NetworkEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [edgePath, labelX, labelY] = useMemo(() => getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  }), [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  const protocol = data?.protocol || 'connected';
  const colors = PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS.default;
  const isHighlighted = data?.isHighlighted;
  const edgeHopIndex = data?.edgeHopIndex;
  const pathActive = data?.pathActive;

  const edgeStyle = useMemo(() => ({
    ...style,
    stroke: isHighlighted ? '#2563eb' : '#64748b',
    strokeWidth: isHighlighted ? 3 : 1.2,
    opacity: isHighlighted ? 1 : (pathActive ? 0.05 : 0.6),
    // Performance: SPECIFIC transitions only. NEVER use 'all' on edges as it creates lag during drag
    transition: 'stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease',
  }), [style, isHighlighted, pathActive]);

  return (
    <>
      {/* Sfumatura soffusa sotto l'arco evidenziato */}
      {isHighlighted && (
        <path
          style={{
            stroke: '#3b82f6',
            strokeWidth: 10,
            filter: 'blur(8px)',
            opacity: 0.2,
          }}
          className="animate-pulse"
          d={edgePath}
        />
      )}
      
      <path
        id={id}
        style={edgeStyle}
        className={cn(
          "react-flow__edge-path",
          isHighlighted ? "stroke-[4px]" : ""
        )}
        d={edgePath}
        markerEnd={markerEnd}
      />

      {/* Label IP/Subnet sempre visibili ma discrete */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none',
          }}
          className="z-50"
        >
          <div className={cn(
            "flex flex-col items-center px-1.5 py-0.5 rounded-md border backdrop-blur-sm shadow-sm",
            isHighlighted
              ? "bg-blue-600 border-blue-500 scale-110 shadow-lg shadow-blue-500/30 text-white z-10 transition-all duration-300"
              : cn(
                  "bg-white/80 border-slate-200 text-slate-500 opacity-70",
                  pathActive && "opacity-0 scale-50 transition-opacity duration-300" 
                )
          )}>
            {isHighlighted && edgeHopIndex && (
              <span className="text-[6px] font-black text-blue-100 mb-0.5 uppercase tracking-tighter">
                Hop {edgeHopIndex}
              </span>
            )}
            <span className={cn(
              "text-[8px] font-bold font-mono tracking-tight",
              isHighlighted ? "text-white" : "text-slate-600"
            )}>
              {data?.subnet}
            </span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

// Define types outside component
const nodeTypes = {
  networkNode: NetworkNode,
};

const edgeTypes = {
  networkEdge: NetworkEdge,
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 160;  
  const nodeHeight = 120; 

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80, 
    ranksep: 140, 
    marginx: 50,
    marginy: 50
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const NetworkMap = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Path simulation state
  const { pathResult, loading: pathLoading, error: pathError, calculatePath: apiCalculatePath, resetPath } = usePath();
  const [sourceNode, setSourceNode] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [originalNodes, setOriginalNodes] = useState([]);
  const [originalEdges, setOriginalEdges] = useState([]);
  const [availableNodes, setAvailableNodes] = useState([]);
  const [showLegend, setShowLegend] = useState(true);
  const [selectionStage, setSelectionStage] = useState('source'); // 'source' or 'target'

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLegend(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const fetchTopology = useCallback(async (isInitial = false) => {
    try {
      if (!isInitial) setIsLoading(true);

      const response = await fetch('http://localhost:8000/api/topology');

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('No snapshot available. Run a network scan first.');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch topology');
      }

      const data = await response.json();

      // Transform backend data to items React Flow understands
      // Backend returns nodes as strings like "fw-milano:root"
      const initialNodes = data.nodes.map(nodeKey => {
        const parts = nodeKey.split(':');
        const deviceId = parts[0];
        const vdom = parts[1] || 'root';

        return {
          id: nodeKey,
          type: 'networkNode',
          data: {
            label: deviceId,
            type: 'firewall', // All nodes with ':' are firewalls
            subtitle: vdom
          }
        };
      });

      // Transform links to edges (Smarter, data-driven approach)
      const initialEdges = data.links.map((link, linkIdx) => {
        const protocol = link.protocol?.toLowerCase() || 'connected';
        const colors = PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS.default;

        // Custom stroke width based on BW
        let strokeWidth = 1.2;
        if (link.bandwidth_mbps) {
          if (link.bandwidth_mbps >= 10000) strokeWidth = 2.2;
          else if (link.bandwidth_mbps >= 1000) strokeWidth = 1.6;
        }

        return {
          id: `e-${linkIdx}`,
          source: link.source,
          target: link.target,
          type: 'networkEdge', // Use the custom memoized edge
          data: {
            ...link,
            protocol: protocol,
          },
          style: {
            strokeWidth: strokeWidth,
            stroke: '#64748b',
            opacity: 0.6
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#64748b',
            width: 14,
            height: 14,
          }
        };
      });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges
      );

      // Update state with minimal triggers
      setOriginalNodes(layoutedNodes);
      setOriginalEdges(layoutedEdges);
      setAvailableNodes(data.nodes);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);

      if (!isInitial) {
        toast.success('Mappa aggiornata con successo');
      }
    } catch (error) {
      console.error(error);
      setError(error.message);

      if (!isInitial) {
        toast.error('Errore nel caricamento della topologia');
      }
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges]);

  // Initial load effect
  useEffect(() => {
    fetchTopology(true);
  }, [fetchTopology]);

  // Optimistic UI check for background updates
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/snapshot/status');
        const status = await res.json();

        if (status.exists) {
          // If the snapshot is very new (less than 10 seconds), maybe we should refresh
          // But for now, let's just keep it simple.
        }
      } catch (e) {}
    };

    const interval = setInterval(checkUpdate, 30000);
    return () => clearInterval(interval);
  }, []);

  // Layout direction change
  const onLayout = useCallback((direction) => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      direction
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [nodes, edges, setNodes, setEdges]);

  // Calculate path and apply highlighting
  const handleCalculatePath = useCallback(async (source, destination) => {
    try {
      const result = await apiCalculatePath(source, destination);
      const pathNodeKeys = new Set(result.nodeKeys || []);
      const pathArray = result.nodeKeys || [];
      const pathLength = pathArray.length;

      // Create a map of edge connections in path for O(1) lookup
      const pathEdges = new Set();
      for (let i = 0; i < pathArray.length - 1; i++) {
        pathEdges.add(`${pathArray[i]}->${pathArray[i+1]}`);
        pathEdges.add(`${pathArray[i+1]}->${pathArray[i]}`);
      }

      // Highlight nodes with clear path visualization
      setNodes(nds => nds.map(node => {
        const pathIndex = pathArray.indexOf(node.id);
        const isInPath = pathIndex !== -1;
        const isPathStart = pathIndex === 0;
        const isPathEnd = pathIndex === pathLength - 1 && pathLength > 1;

        // Only update if something changed to preserve reference where possible
        if (!isInPath && !node.data.pathActive && !node.data.isSource) return node;

        return {
          ...node,
          data: {
            ...node.data,
            isHighlighted: isInPath && !isPathStart && !isPathEnd,
            isPathStart,
            isPathEnd,
            hopIndex: isInPath ? pathIndex + 1 : null,
            pathActive: true,
            isSource: false,
          },
        };
      }));

      // Highlight edges with direction awareness
      setEdges(eds => eds.map(edge => {
        let isHighlighted = pathEdges.has(`${edge.source}->${edge.target}`);
        let edgeHopIndex = null;

        if (isHighlighted) {
          // Find the hop index
          for (let i = 0; i < pathArray.length - 1; i++) {
            if ((edge.source === pathArray[i] && edge.target === pathArray[i+1]) ||
                (edge.source === pathArray[i+1] && edge.target === pathArray[i])) {
              edgeHopIndex = i + 1;
              break;
            }
          }
        }

        if (!isHighlighted && !edge.data.pathActive) return edge;

        return {
          ...edge,
          data: {
            ...edge.data,
            isHighlighted,
            edgeHopIndex,
            pathActive: true,
          },
          style: {
            ...edge.style,
            opacity: isHighlighted ? 1 : 0.05,
          },
          markerEnd: {
            ...edge.markerEnd,
            opacity: isHighlighted ? 1 : 0.05,
          }
        };
      }));

      return result;
    } catch (error) {
      console.error('Path calculation failed:', error);
      throw error;
    }
  }, [apiCalculatePath, setNodes, setEdges]);

  // Reset highlighting
  const handleResetPath = useCallback(() => {
    setNodes([...originalNodes]);
    setEdges([...originalEdges]);
    setSourceNode('');
    setTargetIp('');
    setSelectionStage('source');
    resetPath();
  }, [originalNodes, originalEdges, resetPath, setNodes, setEdges]);

  // Handle node click for quick path selection
  const onNodeClick = useCallback(async (event, node) => {
    // If a path is already showing, reset before starting new selection
    if (pathResult) {
      handleResetPath();
    }

    if (selectionStage === 'source') {
      // For source, we only allow firewall nodes (those in availableNodes)
      if (node.data.type === 'firewall') {
        setSourceNode(node.id);
        setSelectionStage('target');
        
        // Visual feedback: highlight source node in green
        setNodes(nds => nds.map(n => ({
          ...n,
          data: { ...n.data, isSource: n.id === node.id }
        })));

        toast.success(`Sorgente: ${node.data.label}. Ora seleziona la destinazione.`);
      } else {
        toast.error('Seleziona un Firewall come sorgente del percorso.');
      }
    } else {
      // For destination, use the full node_key (node.id) which the backend can resolve
      const destinationValue = node.id;
      setTargetIp(destinationValue);
      setSelectionStage('source');

      // Clear source highlight when calculation starts
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isSource: false } })));

      toast.success(`Calcolo percorso verso ${node.data.label}...`);

      // Auto-calculate
      handleCalculatePath(sourceNode, destinationValue);
    }
  }, [selectionStage, sourceNode, handleCalculatePath, setNodes, pathResult, handleResetPath]);

  // Show error state if no snapshot
  if (error && !isLoading) {
    return (
      <div className="w-full bg-white overflow-hidden relative flex items-center justify-center" style={{ height: '100%' }}>
        <div className="text-center max-w-md p-8">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 mx-auto">
            <Shield className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No Network Data Available</h3>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => fetchTopology()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-3 font-bold text-sm mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white overflow-hidden relative group" style={{ height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        className="bg-slate-50/50"
        proOptions={PRO_OPTIONS}
        onlyRenderVisibleElements={true}
        maxZoom={1.5}
        minZoom={0.2}
      >
        <Background gap={20} color="#e2e8f0" variant="dots" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-lg !rounded-xl overflow-hidden" />

        {/* Path Simulation Panel */}
        <Panel position="top-left" className="!m-4">
          <PathSimulationPanel
            availableNodes={availableNodes}
            onCalculatePath={handleCalculatePath}
            onResetPath={handleResetPath}
            isCalculating={pathLoading}
            pathResult={pathResult}
            pathError={pathError}
            sourceNode={sourceNode}
            setSourceNode={setSourceNode}
            targetIp={targetIp}
            setTargetIp={setTargetIp}
          />
        </Panel>

        <Panel position="top-right">
          <div className="flex flex-col gap-3">
            <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-xl flex gap-1">
              <button 
                onClick={() => onLayout('TB')}
                className="px-4 py-2 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600 uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Layers size={14} />
                Vertical
              </button>
              <button 
                onClick={() => onLayout('LR')}
                className="px-4 py-2 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-slate-600 uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Layers size={14} className="-rotate-90" />
                Horizontal
              </button>
            </div>
            
            <button
              onClick={() => fetchTopology()}
              disabled={isLoading}
              className="px-4 py-3 bg-blue-600 text-white shadow-lg shadow-blue-500/20 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all font-bold text-xs uppercase tracking-wider group"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              <span>{isLoading ? 'ANALYZING...' : 'REBUILD TOPOLOGY'}</span>
            </button>
          </div>
        </Panel>

        <Panel position="bottom-right" className="m-4">
          <div className="flex flex-col items-end gap-3">
            <AnimatePresence>
              {showLegend && (
                <motion.div 
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 1.05, filter: 'blur(10px)' }}
                  className="bg-white/90 backdrop-blur-md p-5 rounded-[2rem] border border-slate-200 shadow-2xl max-w-xs transition-shadow hover:shadow-blue-500/5 group"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">Topology Map</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Reconstruction</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <LegendItem icon={<FirewallIcon />} label="FortiGate FW" />
                    <LegendItem icon={<SwitchIcon />} label="VLAN / Subnet" />
                    <LegendItem icon={<CloudIcon />} label="Network Interconnect" />
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-4 mt-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Link Protocols</p>
                    <EdgeLegendItem color="#22c55e" label="Connected" />
                    <EdgeLegendItem color="#f59e0b" label="Static" />
                    <EdgeLegendItem color="#8b5cf6" label="OSPF" />
                    <EdgeLegendItem color="#06b6d4" label="BGP" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowLegend(!showLegend)}
              className={cn(
                "p-4 rounded-full shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95 group",
                showLegend 
                  ? "bg-white border border-slate-200 text-slate-400" 
                  : "bg-blue-600 text-white"
              )}
            >
              <Info size={24} className={cn("transition-transform duration-500", !showLegend && "group-hover:rotate-12")} />
            </button>
          </div>
        </Panel>

        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 font-bold text-sm animate-pulse">Reconstructing Network Map...</p>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
};

const LegendItem = ({ icon, label }) => (
  <div className="flex items-center gap-3">
    <div className="scale-50 -ml-3 -mr-3">
      {icon}
    </div>
    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{label}</span>
  </div>
);

const EdgeLegendItem = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div className="flex items-center">
      <div
        className="w-8 h-0.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill={color}
        className="-ml-1"
      >
        <path d="M0 0L8 4L0 8Z" />
      </svg>
    </div>
    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
  </div>
);
