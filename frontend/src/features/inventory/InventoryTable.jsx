/**
 * INVENTORY TABLE - Feature Component
 *
 * Componente principale per visualizzare la lista dei firewall.
 * Gestisce automaticamente loading, errori e visualizzazione dati.
 *
 * Pattern Applicato:
 * - Container/Presentational: Logica separata dalla presentazione
 * - Custom Hook: useInventory gestisce lo stato
 * - Composition: Usa componenti UI primitivi riutilizzabili
 *
 * Uso:
 *   <InventoryTable />
 */

import { useInventory } from '../../hooks/useInventory';
import { cn } from '../../lib/utils';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
} from '../../components/ui/Card';
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmptyState,
} from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';
import { RefreshCw, Server, Globe, Shield, Copy, Check, ExternalLink, Plus, List } from 'lucide-react';
import toast from 'react-hot-toast';
import { AddFirewallForm } from './AddFirewallForm';

export const InventoryTable = () => {
  const { inventory, loading, error, refetch } = useInventory();
  const [copiedId, setCopiedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('IP copiato negli appunti');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardBody className="flex flex-col items-center py-20">
          <LoadingSpinner message="Caricamento inventario..." />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody className="py-20 text-center">
          <Alert variant="error" title="Errore" message={error} />
          <button
            onClick={refetch}
            className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold"
          >
            Riprova
          </button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-visible border-none bg-white/60 backdrop-blur-md shadow-2xl shadow-slate-200/50">
      <CardHeader className="flex items-center justify-between border-none pb-0 px-8">
        <div>
          <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Dispositivi Configurati</CardTitle>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              {inventory.length} Firewall Online
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs tracking-tight transition-all flex items-center gap-2 shadow-xl shadow-blue-500/25 active:scale-95"
          >
            <Plus size={16} />
            Aggiungi Firewall
          </button>
          <button
            onClick={refetch}
            className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all group active:rotate-180"
            title="Aggiorna Inventario"
          >
            <RefreshCw className="w-5 h-5 transition-transform duration-500" />
          </button>
        </div>
      </CardHeader>

      <CardBody className="px-0 pb-4 mt-4">
        {inventory.length === 0 ? (
          <TableEmptyState message="Nessun firewall configurato nell'inventario" />
        ) : (
          <>
            {/* DESKTOP VIEW (XL+) */}
            <div className="hidden xl:block">
              <Table containerClassName="!overflow-visible w-full">
                <TableHeader>
                  <TableHeaderCell className="pl-8">Dispositivo</TableHeaderCell>
                  <TableHeaderCell>Network Address</TableHeaderCell>
                  <TableHeaderCell>V-DOM</TableHeaderCell>
                  <TableHeaderCell className="pr-8 text-right">Status</TableHeaderCell>
                </TableHeader>
                <TableBody>
                  {inventory.map((firewall) => (
                    <TableRow 
                      key={firewall.id} 
                      className="group cursor-default hover:z-30 relative hover:bg-blue-50/40 transition-all duration-300 border-b border-slate-50/50 last:border-none"
                    >
                      <TableCell className="pl-8 py-6">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-blue-500/20 transition-all duration-500 shadow-sm">
                            <Server size={24} />
                          </div>
                          <div>
                            <div className="font-black text-slate-900 text-base leading-tight group-hover:text-blue-600 transition-colors">
                              {firewall.id}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">FortiGate FW</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative group/ip">
                            {/* Desktop Tooltip */}
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 scale-95 opacity-0 group-hover/ip:opacity-100 group-hover/ip:scale-100 pointer-events-none transition-all duration-300 z-10">
                              <div className="bg-slate-900 px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2">
                                <span className="text-[10px] font-black text-white whitespace-nowrap tracking-tighter">
                                  OPEN DASHBOARD
                                </span>
                                <ExternalLink size={10} className="text-blue-400" />
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                            </div>

                            <a 
                              href={`https://${firewall.host}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
                            >
                              <Globe size={14} className="text-slate-400 group-hover/ip:text-blue-500" />
                              <code className="text-[13px] font-mono font-bold text-slate-600 group-hover/ip:text-blue-600 transition-colors">
                                {firewall.host.split(':')[0]}
                              </code>
                            </a>
                          </div>

                          <button 
                            onClick={() => copyToClipboard(firewall.host.split(':')[0], firewall.id)}
                            className="p-2 hover:text-blue-600 text-slate-300 transition-colors bg-slate-50 rounded-lg hover:bg-white border border-transparent hover:border-slate-100"
                            title="Copia IP"
                          >
                            {copiedId === firewall.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="relative group/vdom">
                            <div className="flex items-center gap-2.5 bg-slate-900 px-4 py-2 rounded-2xl group-hover/vdom:bg-blue-600 transition-all duration-300 cursor-help shadow-lg shadow-slate-900/10 group-hover/vdom:shadow-blue-500/30 group-hover/vdom:scale-105">
                              <Shield size={14} className="text-blue-400 group-hover/vdom:text-white" />
                              <span className="text-white font-black text-[11px] tracking-wider uppercase">
                                {firewall.vdoms?.length || 1} V-DOM
                              </span>
                            </div>

                             {/* VDOM Popover for Desktop */}
                            {firewall.vdoms?.length > 0 && (
                              <div
                                className="absolute bottom-full left-0 pb-6 -mb-4 w-72 opacity-0 group-hover/vdom:opacity-100 translate-y-2 group-hover/vdom:translate-y-0 scale-95 group-hover/vdom:scale-100 pointer-events-none group-hover/vdom:pointer-events-auto transition-all duration-300 ease-out z-50"
                              >
                                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-[0_30px_90px_rgba(30,41,59,0.4)] relative overflow-hidden">
                                  <div className="bg-slate-900 px-7 py-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/40">
                                        <List size={18} className="text-white" />
                                      </div>
                                      <div>
                                        <span className="block text-[12px] font-black text-white uppercase tracking-[0.2em]">Cluster V-DOM</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{firewall.vdoms.length} segmenti attivi</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="max-h-64 overflow-y-auto py-2 custom-scrollbar bg-white">
                                    {firewall.vdoms.map((vdom, idx) => (
                                      <div 
                                        key={idx} 
                                        className="px-8 py-4 group/item flex items-center justify-between hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-none"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "w-2.5 h-2.5 rounded-full transition-all duration-500",
                                            vdom === firewall.entry_vdom 
                                              ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-pulse' 
                                              : 'bg-slate-200 group-hover/item:bg-blue-400'
                                          )} />
                                          <span className={cn(
                                            "text-[14px] font-bold transition-colors",
                                            vdom === firewall.entry_vdom ? 'text-blue-600' : 'text-slate-600 group-hover/item:text-slate-900'
                                          )}>
                                            {vdom}
                                          </span>
                                        </div>
                                        {vdom === firewall.entry_vdom && (
                                          <span className="text-[9px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-black uppercase border border-blue-100 tracking-tighter shadow-sm shadow-blue-500/5">
                                            Primary
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="bg-slate-50 px-7 py-4 border-t border-slate-100 flex items-center justify-center">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-ping" />
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] italic">
                                        Network Intelligence
                                      </p>
                                    </div>
                                  </div>
                                  <div className="absolute -bottom-1.5 left-10 w-4 h-4 bg-slate-50 border-b border-r border-slate-100 rotate-45" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="pr-8">
                        <div className="flex items-center justify-end gap-4">
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-2xl border border-green-100 group-hover:bg-green-500 group-hover:text-white transition-all duration-300">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full group-hover:bg-white animate-pulse" />
                            <span className="text-[11px] font-black uppercase tracking-widest leading-none">
                              {firewall.enabled ? 'Live' : 'Off'}
                            </span>
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl border border-transparent hover:border-slate-100 transition-all shadow-hover shadow-blue-500/5">
                            <ExternalLink size={18} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* MOBILE/TABLET RESPONSIVE VIEW (< XL) */}
            <div className="xl:hidden flex flex-col gap-4 px-6 md:px-8">
              {inventory.map((firewall) => (
                <motion.div
                  key={firewall.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.99 }}
                  className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all duration-300 relative group overflow-hidden"
                >
                  {/* Status Indicator Absolute Top Right */}
                  <div className="absolute top-6 right-6">
                    <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {firewall.enabled ? 'Live' : 'Off'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                      <Server size={28} />
                    </div>
                    <div>
                         <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                           {firewall.id}
                         </h3>
                         <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                           FortiGate FW
                         </div>
                         <div className="flex items-center gap-3 mt-3">
                           <a 
                             href={`https://${firewall.host}`}
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-blue-400 hover:bg-white transition-colors"
                           >
                              <Globe size={12} className="text-slate-400" />
                              <code className="text-[11px] font-mono font-bold text-slate-600">
                                {firewall.host.split(':')[0]}
                              </code>
                           </a>
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               copyToClipboard(firewall.host.split(':')[0], firewall.id);
                             }}
                             className="p-1.5 text-slate-300 hover:text-blue-600 transition-colors"
                           >
                              {copiedId === firewall.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                           </button>
                         </div>
                    </div>
                  </div>

                  {/* VDOM Section Mobile - Always visible list if < 3, else expander could be added but simpler is vertical list */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
                    <div className="flex items-center gap-2 mb-3">
                       <Shield size={14} className="text-blue-500" />
                       <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                         {firewall.vdoms?.length || 0} Virtual Domains
                       </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {firewall.vdoms?.slice(0, 4).map((vdom, idx) => (
                          <div key={idx} className={cn(
                             "px-3 py-1.5 rounded-lg text-[11px] font-bold border flex items-center gap-2",
                             vdom === firewall.entry_vdom 
                               ? "bg-blue-50 text-blue-700 border-blue-100" 
                               : "bg-white text-slate-600 border-slate-200"
                          )}>
                             {vdom === firewall.entry_vdom && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                             {vdom}
                          </div>
                       ))}
                       {(firewall.vdoms?.length || 0) > 4 && (
                          <div className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-slate-200 text-slate-600 border border-slate-300">
                             +{firewall.vdoms.length - 4} ALTRI
                          </div>
                       )}
                    </div>
                  </div>
                  
                  {/* Action Footer */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <a
                       href={`https://${firewall.host}`}
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                    >
                       Open Web Dashboard
                       <ExternalLink size={14} />
                    </a>
                  </div>

                </motion.div>
              ))}
            </div>
          </>
        )}
      </CardBody>

      {showAddForm && (
        <AddFirewallForm
          onClose={() => setShowAddForm(false)}
          onSuccess={refetch}
        />
      )}
    </Card>
  );
};
