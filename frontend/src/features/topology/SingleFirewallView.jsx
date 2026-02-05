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
import { Shield, Cloud, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import { FirewallIcon } from './Icons';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

// =============================================================================
// CUSTOM NODES
// =============================================================================

const VdomNode = memo(({ data, selected }) => (
  <div className={cn(
    "px-4 py-3 rounded-2xl border-2 flex flex-col items-center min-w-[140px] shadow-sm",
    "transition-[border-color,background-color,box-shadow] duration-300",
    selected
      ? "border-violet-400 bg-violet-50/50 ring-4 ring-violet-50 shadow-md"
      : "border-violet-200 bg-white hover:border-violet-300 hover:shadow-md"
  )}>
    <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-violet-300 !border-none !-top-0.5" />
    <div className="mb-2 p-2 rounded-xl bg-violet-100/50">
      <Shield className="w-5 h-5 text-violet-600" />
    </div>
    <div className="text-center w-full">
      <div className="font-black text-[11px] text-violet-900 tracking-tight truncate">
        {data.label}
      </div>
      <div className="text-[8px] font-bold text-violet-400 uppercase tracking-widest mt-0.5">
        VDOM
      </div>
      {data.interfacesCount !== undefined && (
        <div className="mt-1.5 px-2 py-0.5 bg-violet-100/50 rounded-full">
          <span className="text-[8px] font-bold text-violet-600">
            {data.interfacesCount} ifaces | {data.routesCount} routes
          </span>
        </div>
      )}
    </div>
    <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-violet-300 !border-none !-bottom-0.5" />
  </div>
));

const SubnetNode = memo(({ data }) => (
  <div className={cn(
    "px-3 py-2 rounded-xl border flex flex-col items-center min-w-[100px] shadow-sm",
    "transition-[border-color,background-color] duration-300",
    "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300"
  )}>
    <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-emerald-300 !border-none !-top-0.5" />
    <div className="mb-1 p-1.5 rounded-lg bg-emerald-100/50">
      <Cloud className="w-4 h-4 text-emerald-600" />
    </div>
    <div className="text-center">
      <div className="font-bold text-[9px] text-emerald-800 font-mono tracking-tight">
        {data.label}
      </div>
      <div className="text-[7px] font-bold text-emerald-400 uppercase tracking-widest">
        subnet
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-emerald-300 !border-none !-bottom-0.5" />
  </div>
));

const ExternalPeerNode = memo(({ data }) => (
  <div className={cn(
    "px-3 py-2 rounded-xl border-2 border-dashed flex flex-col items-center min-w-[100px] shadow-sm",
    "transition-[border-color,background-color] duration-300",
    "border-amber-300 bg-amber-50/30 hover:border-amber-400"
  )}>
    <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-amber-300 !border-none !-top-0.5" />
    <div className="mb-1 p-1.5 rounded-lg bg-amber-100/50 scale-75">
      <FirewallIcon />
    </div>
    <div className="text-center">
      <div className="font-black text-[9px] text-amber-900 tracking-tight truncate">
        {data.label}
      </div>
      <div className="text-[7px] font-bold text-amber-400 uppercase tracking-widest">
        {data.subtitle || 'external'}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-amber-300 !border-none !-bottom-0.5" />
  </div>
));

// =============================================================================
// CUSTOM EDGE
// =============================================================================

const InternalEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style = {}, markerEnd, data,
}) => {
  const [edgePath, labelX, labelY] = useMemo(() => getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  }), [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  const isInterVdom = data?.type === 'inter-vdom';
  const isExternal = data?.type === 'external';

  const edgeStyle = useMemo(() => ({
    ...style,
    stroke: isInterVdom ? '#8b5cf6' : isExternal ? '#f59e0b' : '#10b981',
    strokeWidth: isInterVdom ? 2 : 1.5,
    strokeDasharray: isExternal ? '6 3' : undefined,
    opacity: 0.7,
  }), [style, isInterVdom, isExternal]);

  return (
    <>
      <path id={id} style={edgeStyle} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="z-50"
        >
          <div className={cn(
            "flex flex-col items-center px-2 py-1 rounded-lg border backdrop-blur-md shadow-sm",
            isInterVdom
              ? "bg-violet-50/90 border-violet-200 text-violet-700"
              : isExternal
                ? "bg-amber-50/90 border-amber-200 text-amber-700"
                : "bg-emerald-50/90 border-emerald-200 text-emerald-700"
          )}>
            <span className="text-[8px] font-bold font-mono tracking-tight whitespace-nowrap">
              {data?.label}
            </span>
            {data?.sublabel && (
              <span className="text-[7px] font-bold opacity-60 whitespace-nowrap">
                {data.sublabel}
              </span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

// =============================================================================
// NODE/EDGE TYPES (stable references)
// =============================================================================

const nodeTypes = {
  vdomNode: VdomNode,
  subnetNode: SubnetNode,
  externalPeerNode: ExternalPeerNode,
};

const edgeTypes = {
  internalEdge: InternalEdge,
};

// =============================================================================
// LAYOUT
// =============================================================================

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    const w = node.type === 'vdomNode' ? 160 : 120;
    const h = node.type === 'vdomNode' ? 130 : 90;
    dagreGraph.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    const w = node.type === 'vdomNode' ? 160 : 120;
    const h = node.type === 'vdomNode' ? 130 : 90;
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const FIT_VIEW_OPTIONS = { padding: 0.3 };
const PRO_OPTIONS = { hideAttribution: true };

export const SingleFirewallView = ({ firewallData, onBack, excludeDefault, onToggleExcludeDefault }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Build React Flow graph from firewallData
  useEffect(() => {
    if (!firewallData) return;

    const newNodes = [];
    const newEdges = [];
    const subnetNodeIds = new Set();

    // 1. VDOM nodes
    firewallData.vdoms.forEach((vdom) => {
      newNodes.push({
        id: `vdom-${vdom.name}`,
        type: 'vdomNode',
        data: {
          label: vdom.name,
          interfacesCount: vdom.interfaces.length,
          routesCount: vdom.routes_count,
        },
      });

      // Create subnet nodes and edges for each interface
      vdom.interfaces.forEach((iface) => {
        if (!iface.network_id || iface.network_id === '0.0.0.0/0') return;

        const subnetId = `subnet-${iface.network_id}`;
        if (!subnetNodeIds.has(subnetId)) {
          subnetNodeIds.add(subnetId);
          newNodes.push({
            id: subnetId,
            type: 'subnetNode',
            data: { label: iface.network_id },
          });
        }

        newEdges.push({
          id: `e-vdom-${vdom.name}-${iface.name}-${iface.network_id}`,
          source: `vdom-${vdom.name}`,
          target: subnetId,
          type: 'internalEdge',
          data: {
            label: `${iface.name} - ${iface.ip}`,
            type: 'vdom-subnet',
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 12, height: 12 },
        });
      });
    });

    // 2. Inter-VDOM link edges
    firewallData.internal_links.forEach((link, idx) => {
      newEdges.push({
        id: `e-intervdom-${idx}`,
        source: `vdom-${link.source_vdom}`,
        target: `vdom-${link.target_vdom}`,
        type: 'internalEdge',
        data: {
          label: `${link.protocol.toUpperCase()} via ${link.subnet}`,
          sublabel: `cost: ${link.cost}`,
          type: 'inter-vdom',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6', width: 12, height: 12 },
      });
    });

    // 3. External peer nodes and edges
    const externalPeerIds = new Set();
    firewallData.external_peers.forEach((peer, idx) => {
      const peerId = `ext-${peer.peer_device_id}-${peer.peer_vdom}`;
      if (!externalPeerIds.has(peerId)) {
        externalPeerIds.add(peerId);
        newNodes.push({
          id: peerId,
          type: 'externalPeerNode',
          data: {
            label: peer.peer_device_id,
            subtitle: peer.peer_vdom,
          },
        });
      }

      newEdges.push({
        id: `e-ext-${idx}`,
        source: `vdom-${peer.vdom}`,
        target: peerId,
        type: 'internalEdge',
        data: {
          label: peer.subnet,
          sublabel: peer.interface ? `via ${peer.interface}` : undefined,
          type: 'external',
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b', width: 12, height: 12 },
      });
    });

    // Layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

  }, [firewallData, setNodes, setEdges]);

  if (!firewallData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400 text-sm">No firewall data.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white overflow-hidden relative" style={{ height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        className="bg-slate-50/50"
        proOptions={PRO_OPTIONS}
        maxZoom={1.5}
        minZoom={0.2}
      >
        <Background gap={20} color="#e2e8f0" variant="dots" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-lg !rounded-xl overflow-hidden" />

        {/* Header Panel */}
        <Panel position="top-left" className="!m-4">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  {firewallData.device_id}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Single Firewall View
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-3 text-[9px] font-bold uppercase tracking-widest">
              <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-lg">
                {firewallData.vdoms.length} VDOMs
              </span>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">
                {firewallData.subnets.length} Subnets
              </span>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">
                {firewallData.external_peers.length} Peers
              </span>
            </div>

            {/* Exclude Default Toggle */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={onToggleExcludeDefault}
                className="flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:text-slate-800 transition-colors"
              >
                {excludeDefault ? (
                  <ToggleRight className="w-5 h-5 text-violet-500" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                )}
                Exclude Default Route
              </button>
            </div>
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="bottom-right" className="!m-4">
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Legend</p>
            <div className="space-y-2">
              <LegendRow color="bg-violet-500" label="VDOM" />
              <LegendRow color="bg-emerald-500" label="Subnet" />
              <LegendRow color="bg-amber-500" label="External Peer" dashed />
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
              <EdgeLegendRow color="#8b5cf6" label="Inter-VDOM Link" />
              <EdgeLegendRow color="#10b981" label="VDOM → Subnet" />
              <EdgeLegendRow color="#f59e0b" label="External Peer" dashed />
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

const LegendRow = ({ color, label, dashed }) => (
  <div className="flex items-center gap-2">
    <div className={cn(
      "w-3 h-3 rounded",
      color,
      dashed && "border-2 border-dashed border-amber-400 bg-amber-100"
    )} />
    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
  </div>
);

const EdgeLegendRow = ({ color, label, dashed }) => (
  <div className="flex items-center gap-2">
    <div className="flex items-center">
      <div
        className="w-6 h-0.5 rounded-full"
        style={{
          backgroundColor: color,
          ...(dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 4px, transparent 4px, transparent 7px)`, backgroundColor: 'transparent' } : {}),
        }}
      />
      <svg width="6" height="6" viewBox="0 0 8 8" fill={color} className="-ml-0.5">
        <path d="M0 0L8 4L0 8Z" />
      </svg>
    </div>
    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
  </div>
);
