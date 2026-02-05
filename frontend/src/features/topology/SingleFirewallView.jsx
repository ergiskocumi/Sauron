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
import { Shield, ArrowLeft, ToggleLeft, ToggleRight, X, ChevronRight } from 'lucide-react';
import { FirewallIcon } from './Icons';
import { cn } from '../../lib/utils';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_VISIBLE_IFACES = 5;
const VDOM_NODE_WIDTH = 310;
const PEER_NODE_WIDTH = 180;
const PEER_NODE_HEIGHT = 110;

const IFACE_TYPE_BADGE = {
  vlan: { label: 'VLAN', cls: 'bg-teal-100 text-teal-700' },
  tunnel: { label: 'TUN', cls: 'bg-purple-100 text-purple-700' },
  'hard-switch': { label: 'SW', cls: 'bg-slate-200 text-slate-600' },
  physical: { label: 'PHY', cls: 'bg-blue-100 text-blue-700' },
  loopback: { label: 'LO', cls: 'bg-gray-100 text-gray-500' },
};

const PROTOCOL_COLORS = {
  connected: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  ospf: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  bgp: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  static: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
};

const getProtocolStyle = (protocol) =>
  PROTOCOL_COLORS[protocol?.toLowerCase()] || { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' };

// Calculate VDOM card height based on interface count
const calcVdomHeight = (ifaceCount) => {
  const visible = Math.min(ifaceCount, MAX_VISIBLE_IFACES);
  const base = 90; // header (name + protocol summary)
  const ifaceHeader = 22;
  const perIface = 26;
  const overflow = ifaceCount > MAX_VISIBLE_IFACES ? 22 : 0;
  const padding = 20;
  return base + ifaceHeader + visible * perIface + overflow + padding;
};

// =============================================================================
// CUSTOM NODES
// =============================================================================

/** VDOM Card - shows interfaces inline, click to open detail panel */
const VdomCard = memo(({ data, selected }) => {
  const visibleIfaces = data.interfaces?.slice(0, MAX_VISIBLE_IFACES) || [];
  const hiddenCount = Math.max(0, (data.interfaces?.length || 0) - MAX_VISIBLE_IFACES);

  return (
    <div
      className={cn(
        "rounded-2xl border-2 shadow-sm w-[310px] select-none",
        "transition-[border-color,box-shadow] duration-200",
        selected
          ? "border-violet-400 shadow-lg shadow-violet-200/40"
          : "border-violet-200 hover:border-violet-300 hover:shadow-md",
        "bg-white"
      )}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-violet-400 !border-2 !border-white !-top-1" />

      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-violet-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-100">
            <Shield className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-[12px] text-violet-900 tracking-tight truncate">
              {data.label}
            </div>
            <div className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">VDOM</div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">
              {data.interfaces?.length || 0} iface
            </span>
            <span className="text-[8px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
              {data.routesCount} rte
            </span>
          </div>
        </div>

        {/* Protocol summary badges */}
        {data.routeProtocols && Object.keys(data.routeProtocols).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(data.routeProtocols).map(([proto, count]) => {
              const ps = getProtocolStyle(proto);
              return (
                <span key={proto} className={cn("text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded", ps.bg, ps.text)}>
                  {proto}: {count}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Interface Table */}
      <div className="px-3 py-2">
        <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">
          Interfaces
        </div>
        <div className="space-y-0.5">
          {visibleIfaces.map((iface) => {
            const typeBadge = IFACE_TYPE_BADGE[iface.interface_type?.toLowerCase()] || null;
            return (
              <div
                key={iface.name}
                className={cn(
                  "flex items-center gap-1.5 px-1.5 py-1 rounded-lg text-[9px]",
                  iface.is_up ? "bg-slate-50" : "bg-red-50/50"
                )}
              >
                {/* Status dot */}
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", iface.is_up ? "bg-emerald-500" : "bg-red-400")} />
                {/* Name */}
                <span className={cn("font-bold truncate w-[72px] shrink-0", iface.is_up ? "text-slate-800" : "text-red-400 line-through")}>
                  {iface.name}
                </span>
                {/* IP/Prefix */}
                <span className="font-mono text-slate-500 truncate flex-1">
                  {iface.ip}/{iface.prefix_len}
                </span>
                {/* Type badge */}
                {typeBadge && (
                  <span className={cn("text-[7px] font-bold px-1 py-0.5 rounded shrink-0", typeBadge.cls)}>
                    {typeBadge.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {hiddenCount > 0 && (
          <div className="text-center mt-1">
            <span className="text-[8px] font-bold text-violet-500 cursor-pointer hover:underline">
              +{hiddenCount} more — click to expand
            </span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-violet-400 !border-2 !border-white !-bottom-1" />
    </div>
  );
});

/** External Peer Node */
const ExternalPeerCard = memo(({ data }) => (
  <div className={cn(
    "rounded-xl border-2 border-dashed shadow-sm w-[180px] select-none",
    "border-amber-300 bg-amber-50/40 hover:border-amber-400 hover:shadow-md",
    "transition-[border-color,box-shadow] duration-200"
  )}>
    <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-400 !border-2 !border-white !-top-1" />
    <div className="px-3 py-2.5 flex items-center gap-2">
      <div className="p-1 rounded-lg bg-amber-100/80 scale-[0.55] -ml-1.5">
        <FirewallIcon />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-black text-[10px] text-amber-900 tracking-tight truncate">
          {data.label}
        </div>
        <div className="text-[8px] font-bold text-amber-500 uppercase tracking-widest">
          {data.subtitle || 'external'} peer
        </div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-amber-400 !border-2 !border-white !-bottom-1" />
  </div>
));

// =============================================================================
// CUSTOM EDGE - lightweight, no backdrop-blur
// =============================================================================

const FwEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style = {}, markerEnd, data,
}) => {
  const [edgePath, labelX, labelY] = useMemo(() => getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  }), [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition]);

  const isInterVdom = data?.type === 'inter-vdom';
  const isExternal = data?.type === 'external';
  const strokeColor = isInterVdom ? '#8b5cf6' : '#f59e0b';

  const edgeStyle = useMemo(() => ({
    ...style,
    stroke: strokeColor,
    strokeWidth: isInterVdom ? 2.5 : 2,
    strokeDasharray: isExternal ? '8 4' : undefined,
    opacity: 0.8,
  }), [style, strokeColor, isInterVdom, isExternal]);

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
        >
          <div className={cn(
            "flex flex-col items-center px-2.5 py-1.5 rounded-lg border shadow-sm",
            isInterVdom
              ? "bg-white border-violet-200"
              : "bg-white border-amber-200"
          )}>
            {/* Protocol badge for inter-VDOM */}
            {isInterVdom && data?.protocol && (
              <span className={cn(
                "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded mb-0.5",
                getProtocolStyle(data.protocol).bg, getProtocolStyle(data.protocol).text
              )}>
                {data.protocol}
              </span>
            )}
            {/* Interface mapping */}
            {data?.srcIface && data?.dstIface && (
              <span className="text-[8px] font-bold text-slate-600 font-mono whitespace-nowrap">
                {data.srcIface} → {data.dstIface}
              </span>
            )}
            {/* Subnet */}
            <span className="text-[8px] font-bold font-mono text-slate-500 whitespace-nowrap">
              {data?.subnet}
            </span>
            {/* Cost */}
            {data?.cost !== undefined && data.cost !== null && (
              <span className="text-[7px] font-bold text-slate-400 whitespace-nowrap">
                cost: {data.cost}
              </span>
            )}
            {/* External: local interface */}
            {isExternal && data?.localIface && (
              <span className="text-[8px] font-bold text-amber-600 font-mono whitespace-nowrap">
                via {data.localIface}
              </span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

// =============================================================================
// NODE/EDGE TYPES (stable references outside component)
// =============================================================================

const nodeTypes = { vdomCard: VdomCard, externalPeerCard: ExternalPeerCard };
const edgeTypes = { fwEdge: FwEdge };

// =============================================================================
// LAYOUT - bigger spacing, accurate node sizes
// =============================================================================

const getLayoutedElements = (nodes, edges) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 120, ranksep: 180, marginx: 60, marginy: 60 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.data._w, height: node.data._h });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const out = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: { x: pos.x - node.data._w / 2, y: pos.y - node.data._h / 2 },
    };
  });

  return { nodes: out, edges };
};

// =============================================================================
// ROUTING TABLE DETAIL PANEL (slides in from right)
// =============================================================================

const DetailPanel = memo(({ vdom, onClose }) => {
  if (!vdom) return null;

  // Group routes by protocol
  const routesByProtocol = useMemo(() => {
    const groups = {};
    (vdom.routes || []).forEach((r) => {
      const proto = r.protocol || 'unknown';
      if (!groups[proto]) groups[proto] = [];
      groups[proto].push(r);
    });
    // Sort each group by destination
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.destination.localeCompare(b.destination)));
    return groups;
  }, [vdom.routes]);

  const protocolOrder = ['connected', 'ospf', 'bgp', 'static'];
  const sortedProtos = Object.keys(routesByProtocol).sort((a, b) => {
    const ia = protocolOrder.indexOf(a.toLowerCase());
    const ib = protocolOrder.indexOf(b.toLowerCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="absolute top-0 right-0 h-full w-[480px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
        <div className="p-2 rounded-xl bg-violet-100">
          <Shield className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-slate-900 truncate">{vdom.name}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {vdom.interfaces?.length || 0} interfaces | {vdom.routes_count} routes
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Interface Table */}
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Interfaces</h3>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider">
                <th className="text-left py-1 pr-2">Status</th>
                <th className="text-left py-1 pr-2">Name</th>
                <th className="text-left py-1 pr-2">IP / Prefix</th>
                <th className="text-left py-1 pr-2">Network</th>
                <th className="text-left py-1">Type</th>
              </tr>
            </thead>
            <tbody>
              {(vdom.interfaces || []).map((iface) => {
                const typeBadge = IFACE_TYPE_BADGE[iface.interface_type?.toLowerCase()] || null;
                return (
                  <tr key={iface.name} className={cn("border-t border-slate-50", !iface.is_up && "opacity-50")}>
                    <td className="py-1.5 pr-2">
                      <div className={cn("w-2 h-2 rounded-full", iface.is_up ? "bg-emerald-500" : "bg-red-400")} />
                    </td>
                    <td className="py-1.5 pr-2 font-bold text-slate-800">{iface.name}</td>
                    <td className="py-1.5 pr-2 font-mono text-slate-600">{iface.ip}/{iface.prefix_len}</td>
                    <td className="py-1.5 pr-2 font-mono text-slate-400">{iface.network_id}</td>
                    <td className="py-1.5">
                      {typeBadge ? (
                        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded", typeBadge.cls)}>
                          {typeBadge.label}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Routing Table */}
        <div className="px-5 py-3">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Routing Table</h3>

          {sortedProtos.map((proto) => {
            const routes = routesByProtocol[proto];
            const ps = getProtocolStyle(proto);
            return (
              <div key={proto} className="mb-4">
                <div className={cn("flex items-center gap-2 mb-1.5 px-2 py-1 rounded-lg", ps.bg)}>
                  <div className={cn("w-2 h-2 rounded-full", ps.dot)} />
                  <span className={cn("text-[9px] font-black uppercase tracking-widest", ps.text)}>
                    {proto} ({routes.length})
                  </span>
                </div>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="text-slate-400 font-bold uppercase tracking-wider">
                      <th className="text-left py-0.5 pr-2">Destination</th>
                      <th className="text-left py-0.5 pr-2">Gateway</th>
                      <th className="text-left py-0.5 pr-2">Interface</th>
                      <th className="text-right py-0.5 pr-2">Metric</th>
                      <th className="text-right py-0.5">AD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r, i) => (
                      <tr key={i} className={cn("border-t border-slate-50", r.is_default && "bg-red-50/50")}>
                        <td className="py-1 pr-2 font-mono font-bold text-slate-700">
                          {r.destination}
                          {r.is_default && <span className="ml-1 text-[7px] font-black text-red-400">DEFAULT</span>}
                        </td>
                        <td className="py-1 pr-2 font-mono text-slate-500">{r.gateway}</td>
                        <td className="py-1 pr-2 font-bold text-slate-600">{r.interface}</td>
                        <td className="py-1 pr-2 text-right font-mono text-slate-500">{r.metric}</td>
                        <td className="py-1 text-right font-mono text-slate-400">{r.distance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {sortedProtos.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No routes in this VDOM.</p>
          )}
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const FIT_VIEW_OPTIONS = { padding: 0.25 };
const PRO_OPTIONS = { hideAttribution: true };

export const SingleFirewallView = ({ firewallData, onBack, excludeDefault, onToggleExcludeDefault }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedVdom, setSelectedVdom] = useState(null);

  // Build React Flow graph - NO subnet nodes, interfaces embedded in VDOM cards
  useEffect(() => {
    if (!firewallData) return;

    const newNodes = [];
    const newEdges = [];

    // 1. VDOM nodes (rich cards with interfaces inside)
    firewallData.vdoms.forEach((vdom) => {
      const h = calcVdomHeight(vdom.interfaces.length);
      newNodes.push({
        id: `vdom-${vdom.name}`,
        type: 'vdomCard',
        data: {
          label: vdom.name,
          interfaces: vdom.interfaces,
          routesCount: vdom.routes_count,
          routeProtocols: vdom.route_protocols || {},
          _w: VDOM_NODE_WIDTH,
          _h: h,
          _vdom: vdom, // full data for detail panel
        },
      });
    });

    // 2. Inter-VDOM edges (rich labels: protocol, interfaces, subnet, cost)
    firewallData.internal_links.forEach((link, idx) => {
      newEdges.push({
        id: `e-iv-${idx}`,
        source: `vdom-${link.source_vdom}`,
        target: `vdom-${link.target_vdom}`,
        type: 'fwEdge',
        data: {
          type: 'inter-vdom',
          protocol: link.protocol,
          srcIface: link.source_interface,
          dstIface: link.target_interface,
          subnet: link.subnet,
          cost: link.cost,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6', width: 14, height: 14 },
      });
    });

    // 3. External peer nodes and edges
    const peerIdSet = new Set();
    firewallData.external_peers.forEach((peer, idx) => {
      const peerId = `ext-${peer.peer_device_id}-${peer.peer_vdom}`;
      if (!peerIdSet.has(peerId)) {
        peerIdSet.add(peerId);
        newNodes.push({
          id: peerId,
          type: 'externalPeerCard',
          data: {
            label: peer.peer_device_id,
            subtitle: peer.peer_vdom,
            _w: PEER_NODE_WIDTH,
            _h: PEER_NODE_HEIGHT,
          },
        });
      }

      newEdges.push({
        id: `e-ext-${idx}`,
        source: `vdom-${peer.vdom}`,
        target: peerId,
        type: 'fwEdge',
        data: {
          type: 'external',
          subnet: peer.subnet,
          localIface: peer.interface,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b', width: 14, height: 14 },
      });
    });

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
    setNodes(layouted);
    setEdges(layoutedEdges);
  }, [firewallData, setNodes, setEdges]);

  // Handle node click → open detail panel for VDOMs
  const onNodeClick = useCallback((_event, node) => {
    if (node.type === 'vdomCard' && node.data._vdom) {
      setSelectedVdom(node.data._vdom);
    }
  }, []);

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
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        className="bg-slate-50/50"
        proOptions={PRO_OPTIONS}
        onlyRenderVisibleElements={true}
        maxZoom={1.5}
        minZoom={0.15}
      >
        <Background gap={24} color="#e2e8f0" variant="dots" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-lg !rounded-xl overflow-hidden" />

        {/* Header Panel */}
        <Panel position="top-left" className="!m-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={onBack} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </button>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">{firewallData.device_id}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Single Firewall View</p>
              </div>
            </div>

            <div className="flex gap-2 text-[9px] font-bold uppercase tracking-widest">
              <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-lg">{firewallData.vdoms.length} VDOMs</span>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">{firewallData.subnets.length} Subnets</span>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">{firewallData.external_peers.length} Peers</span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={onToggleExcludeDefault}
                className="flex items-center gap-2 text-[10px] font-bold text-slate-600 hover:text-slate-800 transition-colors"
              >
                {excludeDefault ? <ToggleRight className="w-5 h-5 text-violet-500" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                Exclude Default Route
              </button>
              <span className="text-[9px] text-slate-400 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Click VDOM for details
              </span>
            </div>
          </div>
        </Panel>

        {/* Compact Legend */}
        <Panel position="bottom-right" className="!m-4">
          <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 shadow-lg">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Legend</p>
            <div className="space-y-1.5">
              <LegendRow icon={<div className="w-3 h-3 rounded bg-violet-500" />} label="VDOM" />
              <LegendRow icon={<div className="w-3 h-3 rounded border-2 border-dashed border-amber-400 bg-amber-100" />} label="External Peer" />
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-1">
              <EdgeLegendRow color="#8b5cf6" label="Inter-VDOM" />
              <EdgeLegendRow color="#f59e0b" label="External" dashed />
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Detail Panel Overlay */}
      {selectedVdom && (
        <DetailPanel vdom={selectedVdom} onClose={() => setSelectedVdom(null)} />
      )}
    </div>
  );
};

// =============================================================================
// LEGEND HELPERS
// =============================================================================

const LegendRow = ({ icon, label }) => (
  <div className="flex items-center gap-2">
    {icon}
    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">{label}</span>
  </div>
);

const EdgeLegendRow = ({ color, label, dashed }) => (
  <div className="flex items-center gap-2">
    <div className="flex items-center">
      <div className="w-5 h-0.5 rounded-full" style={dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 3px, transparent 3px, transparent 6px)` } : { backgroundColor: color }} />
      <svg width="5" height="5" viewBox="0 0 8 8" fill={color} className="-ml-0.5"><path d="M0 0L8 4L0 8Z" /></svg>
    </div>
    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
  </div>
);
