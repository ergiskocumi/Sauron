import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { Layout } from './components/Layout';
import { InventoryTable } from './features/inventory/InventoryTable';
import { NetworkMap } from './features/topology/NetworkMap';
import { useInventory } from './hooks/useInventory';
import { useSystemInfo } from './hooks/useSystemInfo';
import { Activity, RefreshCw, Server, Info, Zap } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirewallDetailPage } from './features/firewall-detail/FirewallDetailPage';
import { startScan as scanNetwork } from './services/scanService';
import { TABS } from './constants';

function App() {
  const [activeTab, setActiveTab] = useState(TABS.INVENTORY);
  const [selectedFirewallId, setSelectedFirewallId] = useState(null);
  const { inventory, healthById } = useInventory();
  const { info: systemInfo } = useSystemInfo();
  const [isScanning, setIsScanning] = useState(false);

  // Reset firewall detail when switching away from inventory
  const handleSetActiveTab = useCallback((tab) => {
    setActiveTab(tab);
    if (tab !== TABS.INVENTORY) {
      setSelectedFirewallId(null);
    }
  }, []);

  const onlineCount = useMemo(
    () => inventory.filter(f => healthById?.[f.id]?.reachable === true).length,
    [inventory, healthById]
  );
  const offlineCount = useMemo(
    () => inventory.filter(f => healthById?.[f.id]?.reachable === false && f.enabled).length,
    [inventory, healthById]
  );
  const totalCount = inventory.length;
  const syncSuccess = totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0;

  const startScan = async () => {
    setIsScanning(true);
    const toastId = toast.loading('Inizializzazione scansione di rete...');

    try {
      await scanNetwork();

      toast.success('Scansione avviata in background. La mappa si aggiornerà al termine.', {
        id: toastId,
        icon: '🚀'
      });
      
    } catch (error) {
      toast.error('Errore nell\'avvio della scansione: ' + error.message, {
        id: toastId
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            borderRadius: '16px',
            background: '#1e293b',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            padding: '12px 20px',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          },
        }}
      />
      
      <Layout activeTab={activeTab} setActiveTab={handleSetActiveTab}>
        <div className="w-full flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full flex flex-col gap-8"
            >
              {/* Header Dynamic Title */}
              <div className="flex justify-between items-end mb-4 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                      Network Intelligence
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-tight">
                      <Activity size={12} className="text-green-500" />
                      Live Monitoring Active
                    </div>
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                    {activeTab === TABS.INVENTORY
                      ? (selectedFirewallId ? 'Firewall Detail' : 'Inventory Manager')
                      : activeTab === TABS.MAP ? 'Network Topology' : 'System Simulation'}
                  </h1>
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={startScan}
                    disabled={isScanning}
                    className="group px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-3 font-bold text-sm tracking-tight overflow-hidden relative"
                  >
                    <RefreshCw className={cn("w-4 h-4 transition-transform group-hover:rotate-180", isScanning && "animate-spin")} />
                    <span>{isScanning ? 'SCANNING...' : 'SCAN NETWORK'}</span>
                    {isScanning && (
                      <div className="absolute inset-0 bg-blue-600/50 backdrop-blur-sm flex items-center justify-center" />
                    )}
                  </button>
                </div>
              </div>

              {/* Main Content View Switcher */}
              <div className="flex-1 min-h-0">
                {activeTab === TABS.INVENTORY ? (
                  <ErrorBoundary>
                    {selectedFirewallId ? (
                      <FirewallDetailPage
                        firewallId={selectedFirewallId}
                        onBack={() => setSelectedFirewallId(null)}
                      />
                    ) : (
                      <div className="flex flex-col gap-8">
                        {/* Status Pills */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <StatusCard
                            label="Online Devices"
                            value={onlineCount}
                            total={totalCount}
                            color="green"
                            icon={<Server size={18} />}
                          />
                          <StatusCard
                            label="Critical Alerts"
                            value={offlineCount}
                            total={totalCount}
                            color="red"
                            icon={<Activity size={18} />}
                          />
                          <StatusCard
                            label="Sync Success"
                            value={`${syncSuccess}%`}
                            color="blue"
                            icon={<RefreshCw size={18} />}
                          />
                          <StatusCard
                            label="System Info"
                            value={systemInfo?.app_version ? `v${systemInfo.app_version}` : '---'}
                            color="slate"
                            icon={<Info size={18} />}
                          />
                        </div>

                        <InventoryTable onViewDetail={setSelectedFirewallId} />
                      </div>
                    )}
                  </ErrorBoundary>
                ) : activeTab === TABS.MAP ? (
                  <ErrorBoundary>
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/60 h-[calc(100vh-280px)] w-full mb-12">
                      <NetworkMap />
                    </div>
                  </ErrorBoundary>
                ) : (
                  <div className="h-[600px] bg-white rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-slate-400 p-12 shadow-inner">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                       <Zap size={40} className="text-slate-200" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Section in Development</h2>
                    <p className="text-sm max-w-sm text-center">This feature will be available in the next Sauron v0.2 update.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Layout>
    </>
  );
}

const StatusCard = React.memo(({ label, value, total, color, icon }) => {
  const colors = {
    green: 'bg-green-500/10 text-green-600 border-green-200',
    red: 'bg-red-500/10 text-red-600 border-red-200',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-200',
    slate: 'bg-slate-500/10 text-slate-600 border-slate-200',
  };

  return (
    <motion.div 
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn("px-6 py-5 rounded-3xl border bg-white flex items-center gap-5 shadow-sm shadow-slate-200/50 cursor-default transition-shadow hover:shadow-xl hover:shadow-slate-200/60")}
    >
      <div className={cn("p-3.5 rounded-2xl border", colors[color])}>
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">{label}</div>
        <div className="text-2xl font-bold text-slate-900 leading-none tracking-tight">
          {value}{total !== undefined && <span className="text-slate-300 text-lg ml-1 font-medium">/{total}</span>}
        </div>
      </div>
    </motion.div>
  );
});

export default App;
