import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Network, 
  Route, 
  Shield, 
  Server,
  Globe,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Zap,
  MapPin,
  Layers
} from 'lucide-react';

// Mock data
const mockFirewalls = [
  { id: 'fw-milan', name: 'Milan DC', status: 'online', latency: 12, vdoms: 4 },
  { id: 'fw-rome', name: 'Rome Office', status: 'online', latency: 18, vdoms: 2 },
  { id: 'fw-london', name: 'London HQ', status: 'warning', latency: 45, vdoms: 8 },
  { id: 'fw-paris', name: 'Paris Branch', status: 'offline', latency: 0, vdoms: 2 },
  { id: 'fw-berlin', name: 'Berlin DC', status: 'online', latency: 22, vdoms: 6 },
];

const mockTopology = {
  nodes: [
    { id: 'fw1', name: 'Milan DC', x: 50, y: 50, type: 'hub' },
    { id: 'fw2', name: 'Rome', x: 30, y: 70, type: 'spoke' },
    { id: 'fw3', name: 'London', x: 70, y: 30, type: 'spoke' },
    { id: 'fw4', name: 'Paris', x: 25, y: 35, type: 'spoke' },
    { id: 'fw5', name: 'Berlin', x: 75, y: 65, type: 'spoke' },
  ],
  links: [
    { from: 'fw1', to: 'fw2' },
    { from: 'fw1', to: 'fw3' },
    { from: 'fw1', to: 'fw4' },
    { from: 'fw1', to: 'fw5' },
    { from: 'fw3', to: 'fw5' },
  ]
};

const StatusBadge = ({ status }) => {
  const styles = {
    online: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    offline: 'bg-rose-50 text-rose-700 border-rose-200'
  };
  
  const icons = {
    online: <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />,
    warning: <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />,
    offline: <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [scanning, setScanning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('2 minutes ago');
  const [selectedNode, setSelectedNode] = useState(null);
  const [animatedStats, setAnimatedStats] = useState({ firewalls: 0, vdoms: 0, routes: 0 });

  // Animate stats on mount
  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedStats({
        firewalls: Math.round(12 * progress),
        vdoms: Math.round(48 * progress),
        routes: Math.round(1240 * progress)
      });
      
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setLastUpdate('Just now');
    }, 2000);
  };

  return (
    <section id="dashboard" className="relative py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-sm font-medium text-blue-700 mb-4">
            <Activity className="w-4 h-4" />
            Live Dashboard Demo
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
            Your Network at a <span className="gradient-text">Glance</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Real-time visibility into your entire FortiGate infrastructure. 
            Monitor health, explore topology, and simulate paths.
          </p>
        </motion.div>

        {/* Dashboard Container */}
        <motion.div 
          className="bg-white rounded-3xl shadow-2xl shadow-slate-300/50 border border-slate-200 overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Dashboard Header */}
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Sauron Dashboard</h3>
                <p className="text-xs text-slate-500">Last updated: {lastUpdate}</p>
              </div>
            </div>
            <button 
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Network'}
            </button>
          </div>

          <div className="grid lg:grid-cols-3 min-h-[600px]">
            {/* Sidebar */}
            <div className="lg:col-span-1 border-r border-slate-100 p-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-slate-900">{animatedStats.firewalls}</p>
                  <p className="text-xs text-slate-500 font-medium">Firewalls</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-slate-900">{animatedStats.vdoms}</p>
                  <p className="text-xs text-slate-500 font-medium">VDOMs</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-slate-900">{animatedStats.routes}</p>
                  <p className="text-xs text-slate-500 font-medium">Routes</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="space-y-2 mb-6">
                {[
                  { id: 'overview', label: 'Overview', icon: Activity },
                  { id: 'inventory', label: 'Inventory', icon: Server },
                  { id: 'topology', label: 'Topology', icon: Network },
                  { id: 'paths', label: 'Path Sim', icon: Route },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                        activeTab === tab.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.label}
                      {activeTab === tab.id && (
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Status */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-900">System Healthy</span>
                </div>
                <p className="text-sm text-emerald-700">All systems operational. 4/5 firewalls online.</p>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 p-6 bg-slate-50/50">
              <AnimatePresence mode="wait">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* Firewall List */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">Firewall Status</h4>
                        <span className="text-sm text-slate-500">5 devices</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {mockFirewalls.map((fw) => (
                          <div 
                            key={fw.id}
                            className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => setSelectedNode(selectedNode === fw.id ? null : fw.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                fw.status === 'online' ? 'bg-emerald-100' : 
                                fw.status === 'warning' ? 'bg-amber-100' : 'bg-rose-100'
                              }`}>
                                <Server className={`w-5 h-5 ${
                                  fw.status === 'online' ? 'text-emerald-600' : 
                                  fw.status === 'warning' ? 'text-amber-600' : 'text-rose-600'
                                }`} />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{fw.name}</p>
                                <p className="text-xs text-slate-500">{fw.vdoms} VDOMs</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {fw.status === 'online' && (
                                <span className="text-xs text-slate-500">{fw.latency}ms</span>
                              )}
                              <StatusBadge status={fw.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                      <h4 className="font-bold text-slate-900 mb-4">Recent Activity</h4>
                      <div className="space-y-3">
                        {[
                          { action: 'Network scan completed', time: '2m ago', icon: RefreshCw, color: 'blue' },
                          { action: 'New route discovered', time: '15m ago', icon: Route, color: 'purple' },
                          { action: 'Firewall config updated', time: '1h ago', icon: Shield, color: 'emerald' },
                          { action: 'Path simulation run', time: '2h ago', icon: MapPin, color: 'amber' },
                        ].map((item, i) => {
                          const Icon = item.icon;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg bg-${item.color}-100 flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`w-4 h-4 text-${item.color}-600`} />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{item.action}</p>
                                <p className="text-xs text-slate-500">{item.time}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Topology Tab */}
                {activeTab === 'topology' && (
                  <motion.div
                    key="topology"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <div className="bg-white rounded-2xl border border-slate-200 h-[500px] relative overflow-hidden">
                      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur rounded-xl px-3 py-2 border border-slate-200">
                        <p className="text-sm font-semibold text-slate-900">Network Topology</p>
                        <p className="text-xs text-slate-500">Click nodes to inspect</p>
                      </div>
                      
                      {/* Topology Visualization */}
                      <div className="absolute inset-0">
                        {mockTopology.nodes.map((node) => (
                          <motion.button
                            key={node.id}
                            className={`absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl flex flex-col items-center justify-center transition-all ${
                              selectedNode === node.id 
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 scale-110' 
                                : node.type === 'hub' 
                                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300' 
                                  : 'bg-white text-slate-700 border-2 border-slate-200 shadow-lg'
                            }`}
                            style={{ left: `${node.x}%`, top: `${node.y}%` }}
                            onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Server className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-bold">{node.name}</span>
                          </motion.button>
                        ))}

                        {/* Connection lines */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          {mockTopology.links.map((link, i) => {
                            const from = mockTopology.nodes.find(n => n.id === link.from);
                            const to = mockTopology.nodes.find(n => n.id === link.to);
                            return (
                              <motion.line
                                key={i}
                                x1={`${from.x}%`}
                                y1={`${from.y}%`}
                                x2={`${to.x}%`}
                                y2={`${to.y}%`}
                                stroke="#cbd5e1"
                                strokeWidth="2"
                                strokeDasharray="5 5"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 1.5, delay: i * 0.2 }}
                              />
                            );
                          })}
                        </svg>
                      </div>

                      {/* Selected Node Info */}
                      <AnimatePresence>
                        {selectedNode && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute bottom-4 left-4 right-4 bg-white rounded-xl border border-slate-200 p-4 shadow-xl"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-slate-900">
                                  {mockTopology.nodes.find(n => n.id === selectedNode)?.name}
                                </p>
                                <p className="text-sm text-slate-500">Online • 4 VDOMs • 12 interfaces</p>
                              </div>
                              <button 
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                                onClick={(e) => { e.stopPropagation(); }}
                              >
                                View Details
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* Path Simulation Tab */}
                {activeTab === 'paths' && (
                  <motion.div
                    key="paths"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                      <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Route className="w-5 h-5 text-blue-600" />
                        Path Simulation
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Source</label>
                          <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option>Milan DC:root</option>
                            <option>Rome Office:root</option>
                            <option>London HQ:root</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Destination</label>
                          <input 
                            type="text" 
                            placeholder="10.0.0.5"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all hover:scale-[1.02]">
                        Simulate Path
                      </button>

                      {/* Simulated Result */}
                      <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm font-semibold text-slate-700 mb-3">Path Result</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">Milan</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">London</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">Target</span>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm">
                          <span className="text-slate-600">Hop count: <strong className="text-slate-900">2</strong></span>
                          <span className="text-slate-600">Latency: <strong className="text-slate-900">28ms</strong></span>
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Reachable
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Inventory Tab */}
                {activeTab === 'inventory' && (
                  <motion.div
                    key="inventory"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Device</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Location</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mockFirewalls.map((fw) => (
                            <tr key={fw.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Server className="w-5 h-5 text-slate-400" />
                                  <span className="font-semibold text-slate-900">{fw.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{fw.name.split(' ')[0]}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={fw.status} />
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {fw.status === 'offline' ? '-' : `${fw.latency}ms`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div 
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <p className="text-slate-600 mb-4">Ready to get this view of your own network?</p>
          <a 
            href="#" 
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105"
          >
            <Zap className="w-5 h-5" />
            Get Started Free
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Dashboard;
