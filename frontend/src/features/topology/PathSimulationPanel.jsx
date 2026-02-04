/**
 * PATH SIMULATION PANEL - Pathfinder UI Component
 *
 * Pannello di controllo per la simulazione percorsi di rete.
 * Permette all'utente di selezionare sorgente e destinazione e visualizzare il percorso.
 */

import React, { useState } from 'react';
import { Target, Zap, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

export const PathSimulationPanel = ({
  availableNodes,
  onCalculatePath,
  onResetPath,
  isCalculating,
  pathResult,
  pathError,
}) => {
  const [sourceNode, setSourceNode] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!sourceNode) {
      toast.error('Seleziona un nodo sorgente');
      return;
    }

    if (!targetIp) {
      toast.error('Inserisci un IP destinazione');
      return;
    }

    try {
      await onCalculatePath(sourceNode, targetIp);
      toast.success('Percorso calcolato!');
    } catch (error) {
      // Error già gestito dal hook
    }
  };

  const handleReset = () => {
    setSourceNode('');
    setTargetIp('');
    onResetPath();
    toast.success('Mappa resettata');
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl shadow-lg shadow-blue-500/20">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Path Simulation</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Network Route Tracer
            </p>
          </div>
        </div>
        <div
          className={cn(
            'transition-transform duration-300',
            isExpanded && 'rotate-180'
          )}
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Form Content */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4">
          {/* Source Node */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Nodo Sorgente
            </label>
            <select
              value={sourceNode}
              onChange={(e) => setSourceNode(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={isCalculating}
            >
              <option value="">Seleziona firewall...</option>
              {availableNodes.map((nodeKey) => {
                const parts = nodeKey.split(':');
                const deviceId = parts[0];
                const vdom = parts[1] || 'root';
                return (
                  <option key={nodeKey} value={nodeKey}>
                    {deviceId} ({vdom})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Target IP */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              IP Destinazione
            </label>
            <input
              type="text"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              placeholder="es. 8.8.8.8"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={isCalculating}
            />
          </div>

          {/* Error Display */}
          {pathError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-red-700">{pathError}</p>
              </div>
            </div>
          )}

          {/* Path Result Summary */}
          {pathResult && (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-blue-900 uppercase tracking-widest">
                  Risultato
                </span>
              </div>
              <p className="text-sm font-bold text-blue-700">{pathResult.summary}</p>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-blue-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span>{pathResult.nodeKeys.length} hop(s)</span>
                </div>
                <span className="text-blue-300">•</span>
                <span className="uppercase tracking-wider">{pathResult.status}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isCalculating || !sourceNode || !targetIp}
              className={cn(
                'flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2',
                'hover:shadow-2xl hover:shadow-blue-500/30 hover:scale-[1.02]',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
              )}
            >
              {isCalculating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Calculating...</span>
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  <span>Trace Path</span>
                </>
              )}
            </button>

            {pathResult && (
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
