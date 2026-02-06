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
  MessageCircleQuestion,
  GraduationCap,
  Wrench,
  ChevronDown,
  BookOpen,
  Hash,
  Globe,
  Zap,
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
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden mb-6">
      {/* Top Bar with unique glass effect */}
      <div className="relative bg-slate-900 px-6 md:px-10 py-6 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] -mr-48 -mt-48 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 blur-[80px] -ml-32 -mb-32 rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <motion.button
              whileHover={{ scale: 1.05, x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 transition-all shadow-lg"
            >
              <ArrowLeft size={20} className="text-white" />
            </motion.button>
            
            <div className="h-10 w-[1px] bg-white/10 hidden md:block" />

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">
                  {status.hostname || data.device_id}
                </h1>
                <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1.5 shadow-lg shadow-emerald-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Online</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="flex items-center gap-2">
                   <div className="w-4 h-4 rounded bg-white/5 flex items-center justify-center">
                      <Shield size={10} className="text-slate-400" />
                   </div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                     {status.model_name || 'Generic Device'}
                   </span>
                </div>
                <span className="text-slate-600 font-black text-[10px] select-none">•</span>
                <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 uppercase tracking-wider backdrop-blur-md">
                  Firmware v{status.firmware_version}
                </span>
                <span className="text-slate-600 font-black text-[10px] select-none">•</span>
                <span className="text-[10px] font-mono font-bold text-slate-500 tracking-wider">
                  S/N: {status.serial}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col items-end">
               <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                 <Clock size={14} className="text-indigo-400" />
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                   Uptime: <span className="text-white ml-1">{status.uptime_human}</span>
                 </span>
               </div>
               {status.last_sync && (
                 <span className="text-[9px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">
                   Last Sync: {status.last_sync}
                 </span>
               )}
            </div>
            
            <div className="w-[1px] h-10 bg-white/10" />

            <motion.button
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.6, ease: 'circOut' }}
              onClick={onRefresh}
              className="p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 transition-all border border-blue-400/30 active:scale-95"
            >
              <RefreshCw size={20} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Main Stats with Gauges and Pulse */}
      <div className="px-6 md:px-10 py-8 lg:py-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
          {/* Left: Health Gauges */}
          <div className="flex items-center gap-8 md:gap-12">
            <div className="relative group">
              <DonutGauge value={resources.cpu_usage} label="CPU" color="blue" icon={Cpu} size={110} />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform">
                 <Activity size={10} className="text-blue-500" />
              </div>
            </div>
            <div className="relative group">
              <DonutGauge value={resources.memory_usage} label="RAM" color="green" icon={MemoryStick} size={110} />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform">
                 <Hash size={10} className="text-emerald-500" />
              </div>
            </div>
          </div>

          {/* Center: Live Session Pulse */}
          <div className="flex-1 flex flex-col items-center">
            <div className="relative">
              {/* Pulse effect around numbers */}
              <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="relative text-center">
                <div className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter tabular-nums drop-shadow-sm">
                  {resources.session_count.toLocaleString()}
                </div>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
                  <span className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
                    Active Sessions
                  </span>
                </div>
                {resources.setup_rate > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 inline-block"
                  >
                    <span className="text-[11px] font-black text-blue-600 font-mono">
                      LOAD: +{resources.setup_rate} cps
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Summary Pills */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap justify-center lg:justify-end gap-3 md:gap-4 shrink-0">
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
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      className={cn("px-5 py-4 rounded-[1.5rem] border flex flex-col items-center gap-1.5 transition-all cursor-default shadow-sm", colors[color])}
    >
      <div className="p-2 bg-white/50 rounded-xl mb-1 shadow-inner-sm">
        <Icon size={18} />
      </div>
      <span className="text-2xl font-black leading-none tracking-tighter tabular-nums">{value}</span>
      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">{label}</span>
    </motion.div>
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
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Interface</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">IP / CIDR</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Network</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</span>
            </th>
            <th className="text-right py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Bandwidth</span>
            </th>
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

// =============================================================================
// ROUTE EXPLANATION ENGINE
// =============================================================================

const CIDR_GLOSSARY = [
  { cidr: '/32', hosts: '1', desc: 'Singolo host (un solo computer/dispositivo)' },
  { cidr: '/30', hosts: '2', desc: 'Link point-to-point (collegamento diretto tra 2 router)' },
  { cidr: '/24', hosts: '254', desc: 'Subnet classica (ufficio, piano di un edificio)' },
  { cidr: '/16', hosts: '65.534', desc: 'Rete grande (campus, datacenter)' },
  { cidr: '/8', hosts: '16M+', desc: 'Rete enorme (blocco di classe A)' },
  { cidr: '/0', hosts: 'Tutti', desc: 'Qualsiasi destinazione (default route)' },
];

const PROTOCOL_EXPLANATION = {
  connected: {
    simple: 'Rete direttamente collegata al firewall (come una strada sotto casa tua)',
    expert: 'Rete directly connected - automaticamente inserita nel RIB quando l\'interfaccia va UP con un IP configurato',
  },
  static: {
    simple: 'Percorso configurato manualmente dall\'amministratore (come un cartello stradale fisso)',
    expert: 'Rotta statica configurata manualmente - AD default 10, persistente indipendentemente dallo stato dei protocolli di routing',
  },
  ospf: {
    simple: 'Percorso scoperto automaticamente dai router che si parlano tra loro (come un GPS che aggiorna le strade in tempo reale)',
    expert: 'Rotta appresa via OSPF (Open Shortest Path First) - protocollo IGP link-state, AD 110. Il percorso migliore viene calcolato con l\'algoritmo SPF di Dijkstra',
  },
  bgp: {
    simple: 'Percorso appreso da reti esterne/Internet (come le indicazioni tra paesi diversi)',
    expert: 'Rotta BGP (Border Gateway Protocol) - protocollo EGP path-vector, AD 20 (eBGP) o 200 (iBGP). Decisione basata su path attributes (AS-PATH, LOCAL_PREF, MED)',
  },
};

/**
 * Genera una spiegazione human-readable per una rotta.
 * @param {Object} route - { destination, gateway, interface, protocol, metric, distance, is_default }
 * @param {'simple'|'expert'} mode
 * @returns {{ title: string, description: string, details: string[], tags: string[] }}
 */
const generateRouteExplanation = (route, mode = 'simple') => {
  const { destination, gateway, interface: iface, protocol, metric, distance, is_default } = route;
  const proto = protocol?.toLowerCase() || 'unknown';
  const prefix = destination?.split('/')[1];
  const prefixNum = parseInt(prefix, 10);
  const network = destination?.split('/')[0];
  const isNullRoute = gateway === '0.0.0.0' && (!iface || iface === '' || iface === 'Null' || iface === 'blackhole');
  const isConnected = proto === 'connected';
  const isHostRoute = prefixNum === 32;
  const tags = [];

  // Build tags
  if (is_default) tags.push('Default Route');
  if (isHostRoute) tags.push('Host Route');
  if (isNullRoute) tags.push('Null Route');
  if (isConnected) tags.push('Directly Connected');
  tags.push(proto.toUpperCase());

  if (mode === 'simple') {
    return generateSimpleExplanation(route, { proto, prefix, prefixNum, network, isNullRoute, isConnected, isHostRoute, tags });
  }
  return generateExpertExplanation(route, { proto, prefix, prefixNum, network, isNullRoute, isConnected, isHostRoute, tags });
};

const generateSimpleExplanation = (route, ctx) => {
  const { destination, gateway, interface: iface } = route;
  const { proto, prefixNum, network, isNullRoute, isConnected, isHostRoute, tags } = ctx;

  let title, description;
  const details = [];

  // Default route
  if (route.is_default) {
    title = 'Uscita verso Internet';
    description = `Per tutto il traffico senza una destinazione specifica, il firewall lo manda al router ${gateway} tramite l'interfaccia ${iface}. Immagina questa come l'uscita principale dell'edificio: se non sai dove andare, esci da qui.`;
    details.push(`Gateway di default: ${gateway}`);
    details.push(`Interfaccia di uscita: ${iface}`);
    return { title, description, details, tags };
  }

  // Null route (blackhole)
  if (isNullRoute) {
    title = 'Buco nero (traffico scartato)';
    description = `Il traffico verso ${destination} viene deliberatamente scartato. Come un cestino: qualunque pacchetto diretto qui viene buttato via silenziosamente. Si usa per prevenire loop di routing o bloccare reti specifiche.`;
    details.push(`Rete bloccata: ${destination}`);
    return { title, description, details, tags };
  }

  // Host route (/32)
  if (isHostRoute) {
    title = `Rotta verso un singolo dispositivo`;
    description = `Questa rotta punta esattamente a un solo computer/dispositivo con IP ${network}. ${isConnected
      ? `E' collegato direttamente al firewall sull'interfaccia ${iface}.`
      : `I pacchetti passano dal router ${gateway} tramite l'interfaccia ${iface}.`
    }`;
    details.push(`Dispositivo: ${network}`);
    if (!isConnected) details.push(`Passa dal router: ${gateway}`);
    details.push(`Interfaccia: ${iface}`);
    return { title, description, details, tags };
  }

  // Connected route
  if (isConnected) {
    title = 'Rete locale direttamente collegata';
    description = `La rete ${destination} e' fisicamente connessa all'interfaccia ${iface} del firewall. Come i colleghi nello stesso ufficio: per raggiungerli non devi uscire dall'edificio, basta gridare.`;
    details.push(`Rete locale: ${destination}`);
    details.push(`Interfaccia diretta: ${iface}`);
    if (prefixNum === 24) details.push('Dimensione: circa 254 dispositivi possibili');
    if (prefixNum === 16) details.push('Dimensione: rete grande, fino a ~65.000 dispositivi');
    return { title, description, details, tags };
  }

  // Specific network via routing protocol
  const protoName = { static: 'statica', ospf: 'OSPF', bgp: 'BGP' }[proto] || proto;
  title = `Percorso ${protoName} verso ${destination}`;

  if (proto === 'static') {
    description = `L'amministratore ha configurato manualmente che per raggiungere la rete ${destination} si deve passare dal router ${gateway} tramite l'interfaccia ${iface}. Come un cartello stradale fisso messo da qualcuno.`;
  } else if (proto === 'ospf') {
    description = `Il firewall ha scoperto automaticamente che la rete ${destination} e' raggiungibile passando dal router ${gateway} tramite l'interfaccia ${iface}. Come un GPS aggiornato in tempo reale dai router che si parlano tra loro.`;
  } else if (proto === 'bgp') {
    description = `La rete ${destination} e' raggiungibile tramite il router ${gateway} sull'interfaccia ${iface}. Questa informazione arriva dal protocollo BGP, il "sistema postale internazionale" che collega reti diverse (anche su Internet).`;
  } else {
    description = `I pacchetti verso ${destination} vengono inoltrati al router ${gateway} tramite l'interfaccia ${iface}.`;
  }

  details.push(`Rete di destinazione: ${destination}`);
  details.push(`Prossimo router (next-hop): ${gateway}`);
  details.push(`Interfaccia di uscita: ${iface}`);

  if (prefixNum <= 24 && prefixNum > 0) {
    const hosts = Math.pow(2, 32 - prefixNum) - 2;
    details.push(`Dispositivi in questa rete: ~${hosts.toLocaleString()}`);
  }

  return { title, description, details, tags };
};

const generateExpertExplanation = (route, ctx) => {
  const { destination, gateway, interface: iface, distance, metric } = route;
  const { proto, prefixNum, network, isNullRoute, isConnected, isHostRoute, tags } = ctx;

  let title, description;
  const details = [];

  if (route.is_default) {
    title = 'Default Route (0.0.0.0/0)';
    description = `Gateway of last resort: ${gateway} via ${iface}. Matching con Longest Prefix Match (LPM) solo quando nessun prefisso piu' specifico esiste nella RIB/FIB.`;
    details.push(`Next-hop: ${gateway}`);
    details.push(`Egress interface: ${iface}`);
    details.push(`AD: ${distance} | Metric: ${metric}`);
    details.push(`Protocollo sorgente: ${proto.toUpperCase()}`);
    details.push('LPM priority: minima (/0) - ultima risorsa nella forwarding table');
    return { title, description, details, tags };
  }

  if (isNullRoute) {
    title = `Null Route / Blackhole (${destination})`;
    description = `Discard silenzioso per ${destination}. Il traffico matching viene droppato senza generare ICMP unreachable. Usato per: prevenzione routing loop, RTBH (Remotely Triggered Black Hole), o summarization con leak prevention.`;
    details.push(`Prefix: ${destination}`);
    details.push(`AD: ${distance} | Metric: ${metric}`);
    return { title, description, details, tags };
  }

  if (isHostRoute) {
    title = `Host Route (${destination})`;
    description = `Rotta /32 - match esatto per l'host ${network}. Massima priorita' nel LPM. ${isConnected
      ? `Directly connected su ${iface} (ARP/NDP resolution diretta).`
      : `Next-hop ${gateway} via ${iface}.`
    }`;
    details.push(`Host: ${network}`);
    details.push(`AD: ${distance} | Metric: ${metric}`);
    details.push(`Protocollo: ${proto.toUpperCase()}`);
    details.push('LPM priority: massima (/32)');
    return { title, description, details, tags };
  }

  if (isConnected) {
    title = `Connected Network (${destination})`;
    description = `Prefix ${destination} direttamente raggiungibile su ${iface}. AD 0 (massima affidabilita'). La risoluzione L2 avviene tramite ARP (IPv4) o NDP (IPv6) senza next-hop intermedio.`;
    details.push(`Network: ${destination}`);
    details.push(`Interface: ${iface}`);
    details.push(`AD: 0 (connected) | Metric: ${metric}`);
    details.push(`Subnet size: /${prefixNum} = ${Math.pow(2, 32 - prefixNum) - 2} usable hosts`);
    return { title, description, details, tags };
  }

  const protoUpper = proto.toUpperCase();
  title = `${protoUpper} Route: ${destination}`;

  if (proto === 'static') {
    description = `Rotta statica verso ${destination} via ${gateway} (${iface}). AD ${distance}, non dipende da protocolli di routing dinamici. Persistente nella configurazione, ma puo' essere condizionata da IP SLA o interface tracking.`;
  } else if (proto === 'ospf') {
    description = `Rotta OSPF verso ${destination} via ${gateway} (${iface}). AD ${distance}, metrica ${metric} (costo cumulativo basato su bandwidth dei link attraversati). Calcolata con SPF (Dijkstra) sull'LSDB.`;
  } else if (proto === 'bgp') {
    description = `Rotta BGP verso ${destination} via ${gateway} (${iface}). AD ${distance} ${distance === 20 ? '(eBGP)' : distance === 200 ? '(iBGP)' : ''}. Best path selezionato tramite: Weight > LOCAL_PREF > AS-PATH length > Origin > MED > eBGP over iBGP > IGP metric > Router-ID.`;
  } else {
    description = `Rotta ${protoUpper} verso ${destination} via ${gateway} (${iface}). AD ${distance}, metrica ${metric}.`;
  }

  details.push(`Prefix: ${destination}`);
  details.push(`Next-hop: ${gateway}`);
  details.push(`Egress: ${iface}`);
  details.push(`AD: ${distance} | Metric: ${metric}`);
  if (prefixNum > 0 && prefixNum <= 30) {
    details.push(`Subnet: /${prefixNum} = ${(Math.pow(2, 32 - prefixNum) - 2).toLocaleString()} usable hosts`);
  }

  return { title, description, details, tags };
};

// --- ROUTE EXPLANATION UI COMPONENTS ---

const RouteExplanationPanel = memo(({ route, mode }) => {
  const explanation = useMemo(() => generateRouteExplanation(route, mode), [route, mode]);
  const protoStyle = getProtocolStyle(route.protocol);

  const tagColors = {
    'Default Route': 'bg-rose-50 text-rose-700 border-rose-200',
    'Host Route': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Null Route': 'bg-slate-200 text-slate-700 border-slate-300',
    'Directly Connected': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'CONNECTED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'STATIC': 'bg-amber-50 text-amber-700 border-amber-200',
    'OSPF': 'bg-violet-50 text-violet-700 border-violet-200',
    'BGP': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };

  const getPortIcon = (port) => {
    if (!port || port === 'ANY') return <Cpu size={12} />;
    const p = String(port).split(',')[0];
    if (['80', '443', '8080'].includes(p)) return <Globe size={12} />;
    if (['22', '21', '23'].includes(p)) return <Shield size={12} />;
    if (['53'].includes(p)) return <Network size={12} />;
    return <Cpu size={12} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="overflow-hidden"
    >
      <div className={cn(
        "mx-4 mb-6 p-6 rounded-[2rem] border transition-all duration-300",
        mode === 'simple'
          ? "bg-white border-blue-100 shadow-sm"
          : "bg-slate-50 border-slate-200 shadow-sm"
      )}>
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_1.4fr] gap-8">
          {/* Left Column: Essential Explanation */}
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-2xl shrink-0 transition-all",
                mode === 'simple' ? "bg-blue-50 text-blue-600" : "bg-slate-200 text-slate-600"
              )}>
                {mode === 'simple'
                  ? <MessageCircleQuestion size={20} />
                  : <Wrench size={20} />
                }
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h4 className="text-lg font-black text-slate-900 tracking-tight">{explanation.title}</h4>
                  <div className="flex flex-wrap gap-1">
                    {explanation.tags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                          tagColors[tag] || "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <p className={cn(
                  "text-sm leading-relaxed",
                  mode === 'simple' ? "text-slate-600" : "text-slate-500 font-mono"
                )}>
                  {explanation.description}
                </p>
              </div>
            </div>

            {explanation.details.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                {explanation.details.map((detail, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm"
                  >
                    {detail}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Lightweight Visual Path */}
          <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 relative group">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Activity size={12} className="text-slate-300" />
                Dettaglio Percorso
              </span>
              <div className={cn(
                "px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest",
                protoStyle.bg, protoStyle.text, protoStyle.border
              )}>
                {route.protocol || 'N/D'}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 relative">
              {/* Thin Connection Line */}
              <div className="absolute top-7 left-[20%] right-[20%] h-[1px] bg-slate-200 -z-0" />

              {/* Node 1: Origin */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm group-hover:border-blue-200 transition-colors">
                  <Globe size={24} className="text-blue-500" />
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Dest</div>
                  <div className="text-[10px] font-bold text-slate-700 font-mono">{route.destination}</div>
                </div>
              </div>

              {/* Path Link 1 */}
              <div className="flex flex-col items-center">
                 <div className="text-[8px] font-black text-slate-300 uppercase mb-1">AD {route.distance ?? 0}</div>
                 <ChevronRight size={16} className="text-slate-300" />
              </div>

              {/* Node 2: Firewall (Central) */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                  <Shield size={24} className="group-hover:text-white transition-colors" />
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Firewall</div>
                  <div className="px-2 py-0.5 rounded-md bg-indigo-50 text-[9px] font-black text-indigo-700 border border-indigo-100">
                    {route.interface || '---'}
                  </div>
                </div>
              </div>

              {/* Path Link 2 */}
              <div className="flex flex-col items-center">
                 <div className="text-[8px] font-black text-slate-300 uppercase mb-1">MET {route.metric ?? 0}</div>
                 <ChevronRight size={16} className="text-slate-300" />
              </div>

              {/* Node 3: Next Hop */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm group-hover:border-emerald-200 transition-colors">
                  <Server size={24} className="text-slate-600" />
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Next Hop</div>
                  <div className="text-[10px] font-bold text-slate-700 font-mono">{route.gateway || '---'}</div>
                </div>
              </div>
            </div>

            {/* Sub-footer for Ports */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white border border-slate-100">
                    {getPortIcon(route.ports || route.port)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Service Port</span>
                    <span className="text-[10px] font-bold text-slate-700 mt-1">{route.ports || route.port || 'ANY'}</span>
                  </div>
               </div>
               <div className="flex items-center gap-1.5 opacity-50">
                  <Zap size={10} className="text-amber-500" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Live Path Analysis</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const CidrGlossary = memo(({ isOpen, onToggle }) => (
  <div>
    <button
      onClick={onToggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
    >
      <BookOpen size={14} className="text-indigo-600" />
      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">CIDR</span>
      <ChevronDown size={12} className={cn("text-indigo-400 transition-transform", isOpen && "rotate-180")} />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="mt-2 bg-indigo-50/60 border border-indigo-200/60 rounded-2xl p-4">
            <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3">
              Glossario notazione CIDR
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {CIDR_GLOSSARY.map((item) => (
                <div key={item.cidr} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-indigo-100">
                  <code className="text-sm font-black text-indigo-700 font-mono w-8">{item.cidr}</code>
                  <div>
                    <div className="text-[10px] font-bold text-slate-700">{item.desc}</div>
                    <div className="text-[9px] text-slate-400">{item.hosts} host</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));

// --- TAB B: ROUTING MONITOR ---
const RoutingTab = memo(({ routes, routeProtocols }) => {
  const [explanationMode, setExplanationMode] = useState('simple');
  const [expandedRoutes, setExpandedRoutes] = useState(new Set());
  const [showGlossary, setShowGlossary] = useState(false);

  const toggleRoute = (routeKey) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeKey)) next.delete(routeKey);
      else next.add(routeKey);
      return next;
    });
  };
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
      {/* Toolbar: Protocol Summary + Explanation Mode + CIDR Glossary */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Protocol counts */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">
              Totale: {routes.length}
            </div>
            {sortedProtos.map((proto) => {
              const ps = getProtocolStyle(proto);
              const count = routesByProtocol[proto].length;
              return (
                <div key={proto} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", ps.bg, ps.border)}>
                  <div className={cn("w-2.5 h-2.5 rounded-full", ps.dot)} />
                  <span className={cn("text-[10px] font-black uppercase tracking-wider", ps.text)}>
                    {proto}
                  </span>
                  <span className={cn("text-[11px] font-black", ps.text)}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Explanation Mode Toggle */}
          <div className="flex items-center gap-2">
            <CidrGlossary isOpen={showGlossary} onToggle={() => setShowGlossary(p => !p)} />
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
              <button
                onClick={() => setExplanationMode('simple')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  explanationMode === 'simple'
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <GraduationCap size={12} />
                Semplice
              </button>
              <button
                onClick={() => setExplanationMode('expert')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  explanationMode === 'expert'
                    ? "bg-white text-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Wrench size={12} />
                Esperto
              </button>
            </div>
          </div>
        </div>

        {/* Hint */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
          <MessageCircleQuestion size={12} />
          Clicca su una rotta per vederne la spiegazione in modalita' {explanationMode === 'simple' ? 'semplice' : 'esperta'}
        </div>
      </div>

      {/* Routes by Protocol */}
      {sortedProtos.map((proto) => {
        const protoRoutes = routesByProtocol[proto];
        const ps = getProtocolStyle(proto);
        const protoExpl = PROTOCOL_EXPLANATION[proto.toLowerCase()];

        return (
          <div key={proto}>
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl mb-2 border", ps.bg, ps.border)}>
              <div className={cn("w-2 h-2 rounded-full", ps.dot)} />
              <span className={cn("text-[10px] font-black uppercase tracking-widest", ps.text)}>
                {proto}
              </span>
              <span className={cn("text-[10px] font-black", ps.text)}>
                {protoRoutes.length} routes
              </span>
              {protoExpl && (
                <span className={cn("text-[10px] font-medium ml-2 hidden md:inline", ps.text, "opacity-70")}>
                  — {explanationMode === 'simple' ? protoExpl.simple : protoExpl.expert}
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-4 w-8"></th>
                    <th className="text-left py-2 px-4">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Destination</span>
                    </th>
                    <th className="text-left py-2 px-4">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Gateway</span>
                    </th>
                    <th className="text-left py-2 px-4">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Interface</span>
                    </th>
                    <th className="text-right py-2 px-4">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Distance</span>
                    </th>
                    <th className="text-right py-2 px-4">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Metric</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {protoRoutes.map((route, idx) => {
                    const routeKey = `${proto}-${idx}`;
                    const isExpanded = expandedRoutes.has(routeKey);
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          onClick={() => toggleRoute(routeKey)}
                          className={cn(
                            "border-b border-slate-50 hover:bg-slate-50/60 transition-colors cursor-pointer select-none",
                            route.is_default && "bg-red-50/40",
                            isExpanded && "bg-blue-50/30"
                          )}
                        >
                          <td className="py-2 px-2 pl-4">
                            <ChevronDown
                              size={14}
                              className={cn(
                                "text-slate-300 transition-transform duration-200",
                                isExpanded && "rotate-180 text-blue-500"
                              )}
                            />
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "w-1 h-4 rounded-full",
                                route.is_default ? "bg-red-400" : "bg-slate-200"
                              )} />
                              <code className="font-mono font-bold text-xs text-slate-800">
                              {route.destination}
                              </code>
                              {route.is_default && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  Default
                                </span>
                              )}
                            </div>
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
                        {/* Explanation Panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="p-0">
                                <RouteExplanationPanel route={route} mode={explanationMode} />
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
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
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">ID</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Name</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Source</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Destination</span>
            </th>
            <th className="text-left py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Service</span>
            </th>
            <th className="text-center py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Action</span>
            </th>
            <th className="text-center py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Log</span>
            </th>
            <th className="text-right py-3 px-4">
              <span className="px-2 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Traffic</span>
            </th>
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
                      "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-1.5",
                      policy.action === 'accept'
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        policy.action === 'accept' ? "bg-emerald-500" : "bg-red-500"
                      )} />
                      {policy.action === 'accept' ? 'ACCEPT' : 'DENY'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {policy.log_traffic !== 'disable' ? (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-black bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full border border-cyan-100 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        {policy.log_traffic}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">---</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div>
                      <span className="text-xs font-black text-slate-800">{formatBytes(policy.bytes)}</span>
                      <div className="text-[9px] text-slate-400 font-mono">
                        {policy.hit_count.toLocaleString()} hits
                        {isUnused && (
                          <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            UNUSED
                          </span>
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm">{obj.name}</div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      typeInfo.cls
                    )}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <div className="space-y-2 mt-2">
                    {obj.subnet && (
                      <code className="block text-xs font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        {obj.subnet}
                      </code>
                    )}
                    {obj.fqdn && (
                      <code className="block text-xs font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded-lg border border-purple-100">
                        {obj.fqdn}
                      </code>
                    )}
                    {obj.start_ip && obj.end_ip && (
                      <code className="block text-xs font-mono text-teal-700 bg-teal-50 px-2 py-1 rounded-lg border border-teal-100">
                        {obj.start_ip} - {obj.end_ip}
                      </code>
                    )}
                    {obj.associated_interface && (
                      <span className="text-[10px] text-slate-500">
                        via <span className="font-bold text-slate-700">{obj.associated_interface}</span>
                      </span>
                    )}
                    {obj.comment && (
                      <p className="text-[10px] text-slate-400 italic">{obj.comment}</p>
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
  <div className="flex flex-col items-center justify-center py-12">
    <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-lg shadow-slate-200/40 p-6 text-center">
      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
        <Box size={24} className="text-slate-300" />
      </div>
      <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Nessun dato</h3>
      <p className="text-sm text-slate-500 mt-2">{message}</p>
      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-3">
        Verifica la configurazione del VDOM selezionato
      </p>
    </div>
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

  const tabMeta = useMemo(() => {
    if (!currentVdom) return null;

    const counts = {
      [TABS.INTERFACES]: currentVdom.interfaces?.length || 0,
      [TABS.ROUTES]: currentVdom.routes?.length || 0,
      [TABS.POLICIES]: currentVdom.policies?.length || 0,
      [TABS.OBJECTS]: currentVdom.address_objects?.length || 0,
    };

    const config = TAB_CONFIG.find((tab) => tab.id === activeTab);
    return {
      label: config?.label || '',
      Icon: config?.icon,
      count: counts[activeTab] ?? 0,
    };
  }, [currentVdom, activeTab]);

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
            {tabMeta && tabMeta.Icon && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <tabMeta.Icon size={16} className="text-blue-600" />
                  <span className="text-sm font-black text-slate-900">{tabMeta.label}</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {tabMeta.count} elementi
                </div>
              </div>
            )}
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
