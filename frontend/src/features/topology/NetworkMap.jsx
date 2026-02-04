import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position
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
import { Shield, RefreshCw, Layers, MousePointer2, Target, Zap, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { usePath } from '../../hooks/usePath';
import { formatNodesForDropdown } from '../../services/pathService';
import { PathSimulationPanel } from './PathSimulationPanel';

// Custom Node Component
const NetworkNode = ({ data, selected }) => {
  const Icon = useMemo(() => {
    switch (data.type) {
      case 'firewall': return FirewallIcon;
      case 'network': return CloudIcon;
      case 'vlan': return SwitchIcon;
      default: return HostIcon;
    }
  }, [data.type]);

  const colorClass = useMemo(() => {
    switch (data.type) {
      case 'firewall': return 'border-red-400 bg-red-50 text-red-700';
      case 'network': return 'border-slate-400 bg-slate-50 text-slate-700';
      case 'vlan': return 'border-indigo-400 bg-indigo-50 text-indigo-700';
      default: return 'border-blue-400 bg-blue-50 text-blue-700';
    }
  }, [data.type]);

  return (
    <div className={cn(
      "px-3 py-2.5 shadow-lg rounded-xl border transition-all duration-300 flex flex-col items-center min-w-[110px] bg-white group",
      selected 
        ? 'border-blue-500 ring-4 ring-blue-500/10 scale-105 shadow-blue-500/10' 
        : cn('border-slate-100 hover:border-slate-300', colorClass)
    )}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-slate-300 border-2 border-white !-top-1" />
      <div className="mb-1.5 p-1 rounded-lg bg-white/50 group-hover:scale-110 transition-transform duration-300 scale-75 origin-center">
        <Icon />
      </div>
      <div className="text-center w-full px-1">
        <div className="font-bold text-[9px] text-slate-800 truncate tracking-tight">{data.label}</div>
        <div className="text-[8px] font-bold text-slate-400 font-mono uppercase tracking-tighter opacity-60 truncate">
          {data.subtitle}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-slate-300 border-2 border-white !-bottom-1" />
    </div>
  );
};

// Define nodeTypes outside component to prevent recreation on each render
const nodeTypes = {
  networkNode: NetworkNode,
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 160;
  const nodeHeight = 120;

  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100,
    ranksep: 120,
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

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === 'LR' ? Position.Left : Position.Top;
    node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (which is center-based) to the top left
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
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

      // Transform links to edges
      // Each link connects multiple endpoints (subnet), create edges between all pairs
      const initialEdges = [];
      data.links.forEach((link, linkIdx) => {
        const endpoints = link.endpoints;
        // Create edges between all pairs of endpoints in this subnet
        for (let i = 0; i < endpoints.length; i++) {
          for (let j = i + 1; j < endpoints.length; j++) {
            initialEdges.push({
              id: `e-${linkIdx}-${i}-${j}`,
              source: endpoints[i],
              target: endpoints[j],
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

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges
      );

      // Save original state for path reset
      setOriginalNodes([...layoutedNodes]);
      setOriginalEdges([...layoutedEdges]);
      setAvailableNodes(data.nodes);

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
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

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges, setNodes, setEdges]);

  // Calculate path and apply highlighting
  const handleCalculatePath = useCallback(async (source, destination) => {
    try {
      const result = await apiCalculatePath(source, destination);

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
  }, [originalNodes, originalEdges, apiCalculatePath, setNodes, setEdges]);

  // Reset highlighting
  const handleResetPath = useCallback(() => {
    setNodes([...originalNodes]);
    setEdges([...originalEdges]);
    resetPath();
  }, [originalNodes, originalEdges, resetPath, setNodes, setEdges]);

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
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-slate-50/50"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#e2e8f0" variant="dots" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-lg !rounded-xl overflow-hidden" />
        
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
