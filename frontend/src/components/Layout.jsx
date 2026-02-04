import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Network, 
  Database, 
  Map as MapIcon, 
  Zap, 
  Settings, 
  ChevronRight,
  Shield,
  Activity,
  Bell,
  Search,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';

const SIDEBAR_TRANSITION = { type: "spring", stiffness: 300, damping: 30 };

export const Layout = ({ children, activeTab, setActiveTab }) => {
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900 overflow-x-hidden">
      {/* Sidebar */}
      <motion.aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        initial={false}
        animate={{ width: isSidebarHovered ? 280 : 88 }}
        transition={SIDEBAR_TRANSITION}
        className="fixed left-0 top-0 h-full bg-slate-900 text-white shadow-2xl z-50 flex flex-col overflow-hidden border-r border-slate-800"
      >
        {/* Logo Section */}
        <div className="p-6 flex items-center gap-4 h-24">
          <div className="bg-blue-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/30 flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <AnimatePresence>
            {isSidebarHovered && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="whitespace-nowrap"
              >
                <h1 className="text-xl font-bold tracking-tight text-white">Sauron</h1>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-none">
                  Network Intelligence
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 mt-4 space-y-1.5">
          <NavItem
            icon={<MapIcon size={22} />}
            label="Dashboard Map"
            active={activeTab === 'map'}
            onClick={() => setActiveTab('map')}
            isExpanded={isSidebarHovered}
          />
          <NavItem
            icon={<Database size={22} />}
            label="Inventory"
            active={activeTab === 'inventory'}
            onClick={() => setActiveTab('inventory')}
            isExpanded={isSidebarHovered}
          />
          <NavItem
            icon={<Zap size={22} />}
            label="Path Simulation"
            active={activeTab === 'simulation'}
            onClick={() => setActiveTab('simulation')}
            isExpanded={isSidebarHovered}
          />
          <div className="pt-4 pb-2 border-t border-slate-800 mx-2">
            {!isSidebarHovered ? (
              <div className="w-full flex justify-center py-2 opacity-30">
                <div className="w-4 h-[1px] bg-slate-400" />
              </div>
            ) : (
                <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Settings</p>
            )}
          </div>
          <NavItem
            icon={<Settings size={22} />}
            label="Configurations"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
            isExpanded={isSidebarHovered}
          />
        </nav>

        {/* Bottom Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-slate-400" />
            </div>
            <AnimatePresence>
              {isSidebarHovered && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="overflow-hidden"
                >
                  <p className="text-sm font-semibold truncate leading-tight text-white">Admin User</p>
                  <p className="text-[10px] text-slate-500 truncate">Sauron Operator</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* Main Container */}
      <motion.div 
        animate={{ paddingLeft: isSidebarHovered ? 280 : 88 }}
        transition={SIDEBAR_TRANSITION}
        className="flex-1 flex flex-col min-w-0" 
      >
        <div className="w-full flex-1 flex flex-col">
          {/* Top Header */}
          <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
            <div className="h-full px-8 md:px-12 max-w-[1700px] mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4 bg-slate-100/50 px-4 py-2 rounded-2xl border border-slate-200 min-w-[320px] md:w-96">
                <Search className="w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cerca IP, Hostname o VDOM..." 
                  className="bg-transparent border-none outline-none text-sm w-full text-slate-600 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider">System Healthy</span>
                </div>
                
                <div className="relative">
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                    <Bell size={20} />
                  </button>
                  <div className="absolute top-2 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white" />
                </div>
              </div>
            </div>
          </header>

          {/* Centered Content Area */}
          <main className="flex-1 p-8 md:p-12 w-full">
            <div className="max-w-[1700px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </motion.div>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, isExpanded, disabled = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative",
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      )}
    >
      <div className={cn(
        "flex-shrink-0 transition-transform duration-300",
        active ? "scale-110" : "group-hover:scale-110"
      )}>
        {icon}
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="font-medium whitespace-nowrap text-sm text-left block"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {!isExpanded && (
        <div className="absolute left-full ml-6 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] shadow-xl border border-slate-700">
          {label}
        </div>
      )}

      {active && !isExpanded && (
        <motion.div 
          layoutId="activePill"
          className="absolute right-0 w-1 h-6 bg-white rounded-l-full" 
        />
      )}
    </button>
  );
};
