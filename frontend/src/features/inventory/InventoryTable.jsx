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
import { RefreshCw, Server, Globe, Shield, Copy, Check, ExternalLink, Plus } from 'lucide-react';
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
    <Card>
      <CardHeader className="flex items-center justify-between border-none pb-0">
        <div>
          <CardTitle>Dispositivi Configurati</CardTitle>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {inventory.length} Firewall Online
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs tracking-tight transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} />
            Aggiungi Firewall
          </button>
          <button
            onClick={refetch}
            className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all group"
            title="Aggiorna Inventario"
          >
            <RefreshCw className="w-5 h-5 group-active:rotate-180 transition-transform" />
          </button>
        </div>
      </CardHeader>

      <CardBody>
        {inventory.length === 0 ? (
          <TableEmptyState message="Nessun firewall configurato nell'inventario" />
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>Dispositivo</TableHeaderCell>
              <TableHeaderCell>Network Address</TableHeaderCell>
              <TableHeaderCell>V-DOM</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {inventory.map((firewall) => (
                <TableRow key={firewall.id} className="group cursor-default">
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 transition-all duration-500 shadow-sm">
                        <Server size={22} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
                          {firewall.id}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">FortiGate FW</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative group/ip">
                        {/* Tooltip Hover */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 scale-95 opacity-0 group-hover/ip:opacity-100 group-hover/ip:scale-100 pointer-events-none transition-all duration-300 z-10">
                          <div className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl shadow-2xl shadow-blue-500/10 flex items-center gap-2">
                            <span className="text-[10px] font-black text-blue-600 whitespace-nowrap tracking-tighter">VAI AL FW</span>
                            <ExternalLink size={10} className="text-blue-400" />
                          </div>
                          {/* Freccetta Tooltip */}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-b border-r border-slate-100 rotate-45" />
                        </div>

                        <a 
                          href={`https://${firewall.host}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 hover:border-blue-400 hover:bg-white hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                        >
                          <Globe size={14} className="text-slate-300 group-hover/ip:text-blue-500" />
                          <code className="text-[12px] font-mono font-bold text-slate-600 group-hover/ip:text-blue-600 transition-colors">
                            {firewall.host.split(':')[0]}
                          </code>
                        </a>
                      </div>

                      <button 
                        onClick={() => copyToClipboard(firewall.host.split(':')[0], firewall.id)}
                        className="p-1 hover:text-blue-600 text-slate-300 transition-colors"
                        title="Copia IP"
                      >
                        {copiedId === firewall.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400">
                        <Shield size={14} />
                      </div>
                      <span className="text-slate-600 font-bold text-sm tracking-tight">{firewall.entry_vdom}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between">
                      <Badge variant={firewall.enabled ? 'success' : 'gray'}>
                        {firewall.enabled ? 'Live' : 'Disabled'}
                      </Badge>
                      <button className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-blue-600 transition-all">
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
