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
import { RefreshCw, Server, Globe, Shield, Copy, Check, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export const InventoryTable = () => {
  const { inventory, loading, error, refetch } = useInventory();
  const [copiedId, setCopiedId] = useState(null);

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
        <button
          onClick={refetch}
          className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all group"
          title="Aggiorna Inventario"
        >
          <RefreshCw className="w-5 h-5 group-active:rotate-180 transition-transform" />
        </button>
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
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 group-hover:border-blue-100 group-hover:bg-blue-50/30 transition-all duration-300">
                        <code className="text-[12px] font-mono font-bold text-slate-600">
                          {firewall.host}
                        </code>
                        <button 
                          onClick={() => copyToClipboard(firewall.host, firewall.id)}
                          className="p-1 hover:text-blue-600 text-slate-300 transition-colors"
                        >
                          {copiedId === firewall.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
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
    </Card>
  );
};
