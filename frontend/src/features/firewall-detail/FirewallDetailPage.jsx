/**
 * FIREWALL DETAIL PAGE - Feature Component
 *
 * Pagina di dettaglio completa per un singolo firewall.
 * 3 livelli di astrazione:
 *   1. Header: hostname, model, CPU/RAM gauges, session count
 *   2. VDOM Selector: griglia di cards cliccabili
 *   3. Deep Dive: tab system (Interfaces, Routes, Policies, Objects)
 */

import React, { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Cpu,
  MemoryStick,
  Activity,
  Shield,
  Network,
  Route,
  FileText,
  Box,
  RefreshCw,
  Clock,
  Server,
  ChevronRight,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFirewallDetail } from '../../hooks/useFirewallDetail';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS = {
  INTERFACES: 'interfaces',
  ROUTES: 'routes',
  POLICIES: 'policies',
  OBJECTS: 'objects',
};

const TAB_CONFIG = [
  { id: TABS.INTERFACES, label: 'Interfacce', icon: Network },
  { id: TABS.ROUTES, label: 'Routing', icon: Route },
  { id: TABS.POLICIES, label: 'Policies', icon: FileText },
  { id: TABS.OBJECTS, label: 'Objects', icon: Box },
];

const PROTOCOL_STYLES = {
  connected: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  static: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  ospf: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  bgp: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
};

const IFACE_TYPE_BADGE = {
  vlan: { label: 'VLAN', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  tunnel: { label: 'TUNNEL', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  'hard-switch': { label: 'SWITCH', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  physical: { label: 'PHYSICAL', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  loopback: { label: 'LOOPBACK', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const getProtocolStyle = (protocol) =>
  PROTOCOL_STYLES[protocol?.toLowerCase()] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };

// =============================================================================
// DONUT GAUGE COMPONENT (SVG)
// =============================================================================

const DonutGauge = memo(({ value, label, color, icon: Icon, size = 100 }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const colorMap = {
    blue: { stroke: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { stroke: '#22c55e', bg: 'bg-green-50', text: 'text-green-600' },
    amber: { stroke: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-600' },
    red: { stroke: '#ef4444', bg: 'bg-red-50', text: 'text-red-600' },
  };

  const getColor = () => {
    if (value >= 90) return colorMap.red;
    if (value >= 70) return colorMap.amber;
    return colorMap[color] || colorMap.blue;
  };

  const c = getColor();

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={c.stroke} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-900 leading-none">{value}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Icon size={14} className={c.text} />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
});

// =============================================================================
// LEVEL 1: HEADER (GLOBAL VIEW)
// =============================================================================

const FirewallHeader = memo(({ data, onBack, onRefresh }) => {
  const { system_status: status, system_resources: resources } = data;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-slate-900 px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start md:items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {status.hostname || data.device_id}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {status.model_name && (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {status.model_name}
                </span>
              )}
              {status.firmware_version && (
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {status.firmware_version}
                </span>
              )}
              {status.serial && (
                <span className="text-[10px] font-mono text-slate-500">
                  S/N: {status.serial}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl">
            <Wifi size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">
              Live Monitoring
            </span>
          </div>
          {status.uptime > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl">
              <Clock size={14} className="text-slate-400" />
              <span className="text-[11px] font-bold text-slate-300">
                Uptime: {status.uptime_human}
              </span>
            </div>
          )}
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors group"
          >
            <RefreshCw size={16} className="text-white group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </div>

      {/* Resource Gauges */}
      <div className="px-6 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-[auto_auto_1fr_auto] gap-6 lg:gap-8 items-center">
        <div className="flex items-center gap-6 justify-center lg:justify-start">
          <DonutGauge value={resources.cpu_usage} label="CPU" color="blue" icon={Cpu} />
          <DonutGauge value={resources.memory_usage} label="RAM" color="green" icon={MemoryStick} />
        </div>

        {/* Session Counter */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              {resources.session_count.toLocaleString()}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Activity size={14} className="text-blue-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Sessioni Attive
              </span>
            </div>
            {resources.setup_rate > 0 && (
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                +{resources.setup_rate}/sec
              </span>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex flex-wrap justify-center lg:justify-end gap-4">
          <StatPill label="VDOMs" value={data.vdoms.length} icon={Shield} color="violet" />
          <StatPill
            label="Subnets"
            value={data.subnets?.length || 0}
            icon={Network}
            color="emerald"
          />
          <StatPill
            label="Peers"
            value={data.external_peers?.length || 0}
            icon={Server}
            color="amber"
          />
        </div>
      </div>
    </div>
  );
});

const StatPill = ({ label, value, icon: Icon, color }) => {
  const colors = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  return (
    <div className={cn("px-4 py-3 rounded-2xl border flex flex-col items-center gap-1", colors[color])}>
      <Icon size={16} />
      <span className="text-xl font-black leading-none">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
};

// =============================================================================
// LEVEL 2: VDOM SELECTOR
// =============================================================================

const VdomSelector = memo(({ vdoms, selectedVdom, onSelect }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
      {vdoms.map((vdom) => {
        const isSelected = selectedVdom === vdom.name;
        const totalIfaces = vdom.interfaces?.length || 0;
        const upIfaces = vdom.interfaces?.filter(i => i.is_up).length || 0;
        const allUp = totalIfaces > 0 && upIfaces === totalIfaces;
        const someDown = totalIfaces > 0 && upIfaces < totalIfaces;
        const healthLabel = allUp ? 'Healthy' : someDown ? 'Degraded' : 'Down';
        const progress = totalIfaces > 0 ? Math.round((upIfaces / totalIfaces) * 100) : 0;

        return (
          <motion.button
            key={vdom.name}
            onClick={() => onSelect(vdom.name)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "relative p-5 rounded-2xl border-2 text-left transition-all duration-300 min-h-[170px]",
              isSelected
                ? "bg-gradient-to-br from-blue-600 to-blue-700 border-blue-600 text-white shadow-xl shadow-blue-500/30"
                : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg shadow-slate-200/60"
            )}
          >
            {/* Status dot */}
            <div className="absolute top-4 right-4">
              <div className={cn(
                "w-3 h-3 rounded-full",
                allUp ? "bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                someDown ? "bg-amber-500" : "bg-red-500",
                isSelected && "ring-2 ring-white"
              )} />
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "p-2 rounded-xl",
                isSelected ? "bg-white/20" : "bg-violet-50"
              )}>
                <Shield size={18} className={isSelected ? "text-white" : "text-violet-600"} />
              </div>
              <div>
                <div className={cn(
                  "font-black text-sm tracking-tight leading-tight",
                  isSelected ? "text-white" : "text-slate-900"
                )}>
                  {vdom.name}
                </div>
                <div className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  isSelected ? "text-blue-200" : "text-slate-400"
                )}>
                  VDOM
                </div>
              </div>
            </div>

            {/* Health label */}
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                allUp && (isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"),
                someDown && (isSelected ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700"),
                !allUp && !someDown && (isSelected ? "bg-white/20 text-white" : "bg-red-50 text-red-700")
              )}>
                {healthLabel}
              </span>
              <span className={cn("text-[10px] font-bold", isSelected ? "text-blue-100" : "text-slate-500")}>
                {progress}% up
              </span>
            </div>

            {/* Progress bar */}
            <div className={cn("h-1.5 w-full rounded-full overflow-hidden", isSelected ? "bg-white/20" : "bg-slate-100")}>
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  allUp && (isSelected ? "bg-white" : "bg-emerald-500"),
                  someDown && (isSelected ? "bg-white" : "bg-amber-500"),
                  !allUp && !someDown && (isSelected ? "bg-white" : "bg-red-500")
                )}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className={cn("text-[10px] font-bold", isSelected ? "text-blue-100" : "text-slate-500")}>
                <span className="font-black text-sm">{upIfaces}</span>/{totalIfaces} iface
              </div>
              <div className={cn("text-[10px] font-bold", isSelected ? "text-blue-100" : "text-slate-500")}>
                <span className="font-black text-sm">{vdom.routes_count || 0}</span> routes
              </div>
            </div>

            {/* Policies/Objects count */}
            <div className="flex items-center gap-2 mt-2">
              {(vdom.policies?.length > 0) && (
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full",
                  isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                )}>
                  {vdom.policies.length} policies
                </span>
              )}
              {(vdom.address_objects?.length > 0) && (
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full",
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                )}>
                  {vdom.address_objects.length} objects
                </span>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
});

// =============================================================================
// LEVEL 3: DEEP DIVE TABS
// =============================================================================

// --- TAB A: INTERFACES ---
const InterfacesTab = memo(({ interfaces }) => {
  if (!interfaces?.length) {
    return <EmptyTabState message="Nessuna interfaccia configurata in questo VDOM." />;
  }

  const total = interfaces.length;
  const upCount = interfaces.filter((iface) => iface.is_up).length;
  const downCount = total - upCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">
          Totale: {total}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase tracking-widest text-emerald-700">
          Up: {upCount}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-black uppercase tracking-widest text-red-700">
          Down: {downCount}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Interface</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">IP / CIDR</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Network</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
            <th className="text-right py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bandwidth</th>
            </tr>
          </thead>
          <tbody>
            {interfaces.map((iface, idx) => {
              const typeBadge = IFACE_TYPE_BADGE[iface.interface_type?.toLowerCase()];
              return (
                <tr
                  key={iface.name || idx}
                  className={cn(
                    "border-b border-slate-50 transition-colors hover:bg-slate-50/80",
                    !iface.is_up && "opacity-60"
                  )}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {iface.is_up ? (
                        <Wifi size={14} className="text-emerald-500" />
                      ) : (
                        <WifiOff size={14} className="text-red-400" />
                      )}
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider",
                        iface.is_up ? "text-emerald-600" : "text-red-500"
                      )}>
                        {iface.is_up ? 'UP' : 'DOWN'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900">{iface.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <code className="font-mono text-slate-600 text-xs bg-slate-50 px-2 py-1 rounded-lg">
                      {iface.ip}/{iface.prefix_len}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-mono text-slate-400">{iface.network_id}</span>
                  </td>
                  <td className="py-3 px-4">
                    {typeBadge ? (
                      <span className={cn("text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border", typeBadge.cls)}>
                        {typeBadge.label}
                      </span>
                    ) : (
                      <span className="text-slate-300">---</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {iface.bandwidth_mbps ? (
                      <span className="text-xs font-bold text-slate-600">{iface.bandwidth_mbps} Mbps</span>
                    ) : (
                      <span className="text-slate-300">---</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// --- TAB B: ROUTING MONITOR ---
const RoutingTab = memo(({ routes, routeProtocols }) => {
  const routesByProtocol = useMemo(() => {
    const groups = {};
    (routes || []).forEach((r) => {
      const proto = r.protocol || 'unknown';
      if (!groups[proto]) groups[proto] = [];
      groups[proto].push(r);
    });
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.destination.localeCompare(b.destination)));
    return groups;
  }, [routes]);

  const protocolOrder = ['connected', 'static', 'ospf', 'bgp'];
  const sortedProtos = Object.keys(routesByProtocol).sort((a, b) => {
    const ia = protocolOrder.indexOf(a.toLowerCase());
    const ib = protocolOrder.indexOf(b.toLowerCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  if (!routes?.length) {
    return <EmptyTabState message="Nessuna rotta configurata in questo VDOM." />;
  }

  return (
    <div className="space-y-6">
      {/* Protocol Summary */}
      <div className="flex flex-wrap gap-3">
        {sortedProtos.map((proto) => {
          const ps = getProtocolStyle(proto);
          const count = routesByProtocol[proto].length;
          return (
            <div key={proto} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border", ps.bg, ps.border)}>
              <div className={cn("w-2.5 h-2.5 rounded-full", ps.dot)} />
              <span className={cn("text-[11px] font-black uppercase tracking-wider", ps.text)}>
                {proto}
              </span>
              <span className={cn("text-sm font-black", ps.text)}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Routes by Protocol */}
      {sortedProtos.map((proto) => {
        const protoRoutes = routesByProtocol[proto];
        const ps = getProtocolStyle(proto);
        return (
          <div key={proto}>
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl mb-2", ps.bg)}>
              <div className={cn("w-2 h-2 rounded-full", ps.dot)} />
              <span className={cn("text-[10px] font-black uppercase tracking-widest", ps.text)}>
                {proto} ({protoRoutes.length})
              </span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</th>
                    <th className="text-left py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gateway</th>
                    <th className="text-left py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Interface</th>
                    <th className="text-right py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Distance</th>
                    <th className="text-right py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Metric</th>
                  </tr>
                </thead>
                <tbody>
                  {protoRoutes.map((route, idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        "border-b border-slate-50 hover:bg-slate-50/60 transition-colors",
                        route.is_default && "bg-red-50/40"
                      )}
                    >
                      <td className="py-2 px-4">
                        <code className="font-mono font-bold text-xs text-slate-800">
                          {route.destination}
                        </code>
                        {route.is_default && (
                          <span className="ml-2 text-[8px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                            DEFAULT
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <code className="font-mono text-xs text-slate-500">{route.gateway}</code>
                      </td>
                      <td className="py-2 px-4">
                        <span className="text-xs font-bold text-slate-600">{route.interface}</span>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <span className="font-mono text-xs text-slate-500">{route.distance}</span>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <span className="font-mono text-xs text-slate-500">{route.metric}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// --- TAB C: FIREWALL POLICIES ---
const PoliciesTab = memo(({ policies }) => {
  if (!policies?.length) {
    return <EmptyTabState message="Nessuna policy configurata in questo VDOM." />;
  }

  const total = policies.length;
  const disabledCount = policies.filter((p) => p.status === 'disable').length;
  const unusedCount = policies.filter((p) => p.hit_count === 0).length;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">
          Totale: {total}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-black uppercase tracking-widest text-amber-700">
          Unused: {unusedCount}
        </div>
        <div className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">
          Disabled: {disabledCount}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</th>
            <th className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service</th>
            <th className="text-center py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
            <th className="text-center py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Log</th>
            <th className="text-right py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Traffic</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => {
              const isUnused = policy.hit_count === 0;
              const isDisabled = policy.status === 'disable';
              return (
                <tr
                  key={policy.policy_id}
                  className={cn(
                    "border-b border-slate-50 hover:bg-slate-50/60 transition-colors",
                    isUnused && "bg-amber-50/30",
                    isDisabled && "opacity-50"
                  )}
                >
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-500 text-xs">#{policy.policy_id}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <span className="font-bold text-slate-900 text-xs">{policy.name || '---'}</span>
                      {policy.comments && (
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[240px]">{policy.comments}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {policy.src_interfaces.map((iface, i) => (
                          <span key={i} className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                            {iface}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {policy.src_addresses.map((addr, i) => (
                          <span key={i} className="text-[9px] font-mono text-slate-500">{addr}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {policy.dst_interfaces.map((iface, i) => (
                          <span key={i} className="text-[9px] font-bold bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded border border-violet-100">
                            {iface}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {policy.dst_addresses.map((addr, i) => (
                          <span key={i} className="text-[9px] font-mono text-slate-500">{addr}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {policy.services.map((svc, i) => (
                        <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {svc}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full",
                      policy.action === 'accept'
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    )}>
                      {policy.action === 'accept' ? 'ACCEPT' : 'DENY'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {policy.log_traffic !== 'disable' ? (
                      <span className="text-[9px] font-bold bg-cyan-50 text-cyan-700 px-2 py-1 rounded border border-cyan-100 uppercase">
                        {policy.log_traffic}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">---</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div>
                      <span className="text-xs font-bold text-slate-700">{formatBytes(policy.bytes)}</span>
                      <div className="text-[9px] text-slate-400 font-mono">
                        {policy.hit_count.toLocaleString()} hits
                        {isUnused && (
                          <span className="ml-1 text-amber-600 font-black">UNUSED</span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// --- TAB D: ADDRESS OBJECTS ---
const ObjectsTab = memo(({ objects }) => {
  if (!objects?.length) {
    return <EmptyTabState message="Nessun oggetto indirizzo configurato in questo VDOM." />;
  }

  const grouped = useMemo(() => {
    const groups = {};
    objects.forEach((obj) => {
      const type = obj.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(obj);
    });
    return groups;
  }, [objects]);

  const typeLabels = {
    ipmask: { label: 'IP / Subnet', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    fqdn: { label: 'FQDN', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    iprange: { label: 'IP Range', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, objs]) => {
        const typeInfo = typeLabels[type] || { label: type.toUpperCase(), cls: 'bg-slate-100 text-slate-600 border-slate-200' };
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border", typeInfo.cls)}>
                {typeInfo.label}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{objs.length} oggetti</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {objs.map((obj) => (
                <div
                  key={obj.name}
                  className="bg-white border border-slate-100 rounded-2xl p-4 hover:border-blue-200 hover:shadow-md transition-all"
                >
                  <div className="font-bold text-slate-900 text-sm mb-1">{obj.name}</div>
                  <div className="space-y-1">
                    {obj.subnet && (
                      <code className="block text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                        {obj.subnet}
                      </code>
                    )}
                    {obj.fqdn && (
                      <code className="block text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                        {obj.fqdn}
                      </code>
                    )}
                    {obj.start_ip && obj.end_ip && (
                      <code className="block text-xs font-mono text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">
                        {obj.start_ip} - {obj.end_ip}
                      </code>
                    )}
                    {obj.associated_interface && (
                      <span className="text-[10px] text-slate-400">
                        via <span className="font-bold">{obj.associated_interface}</span>
                      </span>
                    )}
                    {obj.comment && (
                      <p className="text-[10px] text-slate-400 italic mt-1">{obj.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

const EmptyTabState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
      <Box size={28} className="text-slate-200" />
    </div>
    <p className="text-sm text-slate-400 font-medium">{message}</p>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const FirewallDetailPage = ({ firewallId, onBack }) => {
  const { data, loading, error, refetch } = useFirewallDetail(firewallId);
  const [selectedVdom, setSelectedVdom] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.INTERFACES);

  // Auto-select first VDOM when data loads
  const currentVdom = useMemo(() => {
    if (!data?.vdoms?.length) return null;
    const name = selectedVdom || data.vdoms[0].name;
    return data.vdoms.find(v => v.name === name) || data.vdoms[0];
  }, [data, selectedVdom]);

  const handleVdomSelect = (vdomName) => {
    setSelectedVdom(vdomName);
    setActiveTab(TABS.INTERFACES);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <RefreshCw size={22} className="text-blue-600 animate-spin" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Caricamento dettaglio firewall</h2>
            <p className="text-sm text-slate-500 mt-1">
              Stiamo recuperando lo stato live e i dati di configurazione.
            </p>
            <div className="mt-6">
              <LoadingSpinner message="Sincronizzazione in corso..." />
            </div>
          </div>

          <div className="mt-8">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Suggerimenti rapidi
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-100 rounded-2xl px-4 py-3">
                <Wifi size={16} className="text-emerald-500" />
                <span className="text-sm text-slate-700">Assicurati che la VPN sia attiva</span>
                <span className="ml-auto text-[10px] text-slate-400 font-bold uppercase tracking-widest">consigliato</span>
              </div>
              <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-100 rounded-2xl px-4 py-3">
                <WifiOff size={16} className="text-amber-500" />
                <span className="text-sm text-slate-700">Se il caricamento è lento, prova a ricaricare</span>
                <span className="ml-auto text-[10px] text-slate-400 font-bold uppercase tracking-widest">timeout</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 p-8">
          <Alert variant="error" title="Errore" message={error} />

          <div className="mt-6">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Cosa controllare
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-100 rounded-2xl px-4 py-3">
                <Wifi size={16} className="text-emerald-500" />
                <span className="text-sm text-slate-700">VPN attiva verso la rete dei firewall</span>
              </div>
              <div className="flex items-center gap-3 bg-slate-50/80 border border-slate-100 rounded-2xl px-4 py-3">
                <WifiOff size={16} className="text-amber-500" />
                <span className="text-sm text-slate-700">Se il firewall è offline, il dettaglio può fallire</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={onBack}
              className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              Torna all'Inventory
            </button>
            <button
              onClick={refetch}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* LEVEL 1: Header */}
      <FirewallHeader data={data} onBack={onBack} onRefresh={refetch} />

      {/* LEVEL 2: VDOM Selector */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-violet-600" />
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Virtual Domains</h2>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">
            Seleziona un VDOM per il dettaglio
          </span>
        </div>
        <VdomSelector
          vdoms={data.vdoms}
          selectedVdom={currentVdom?.name}
          onSelect={handleVdomSelect}
        />
      </div>

      {/* LEVEL 3: Deep Dive */}
      {currentVdom && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Tab Bar */}
          <div className="border-b border-slate-200 px-4 md:px-6 py-2 flex flex-col md:flex-row md:items-center md:gap-3 gap-2 bg-white/80 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <ChevronRight size={14} className="text-slate-300" />
              <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">
                {currentVdom.name}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                VDOM selezionato
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "relative px-4 py-2 text-sm font-bold transition-all flex items-center gap-2 rounded-xl whitespace-nowrap",
                    activeTab === id
                      ? "text-blue-600 bg-blue-50"
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon size={16} />
                  {label}
                  {activeTab === id && (
                    <motion.div
                      layoutId="activeDetailTab"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === TABS.INTERFACES && (
                  <InterfacesTab interfaces={currentVdom.interfaces} />
                )}
                {activeTab === TABS.ROUTES && (
                  <RoutingTab routes={currentVdom.routes} routeProtocols={currentVdom.route_protocols} />
                )}
                {activeTab === TABS.POLICIES && (
                  <PoliciesTab policies={currentVdom.policies} />
                )}
                {activeTab === TABS.OBJECTS && (
                  <ObjectsTab objects={currentVdom.address_objects} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
};
