import { motion } from 'framer-motion';
import { Shield, Network, Activity, ArrowRight, Play, CheckCircle2, Server, RefreshCw } from 'lucide-react';
import WorldMapBackground from './WorldMapBackground';

const Hero = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { 
        staggerChildren: 0.12,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
    }
  };

  const benefits = [
    'Automated network discovery',
    'Real-time topology mapping',
    'Visual path simulation'
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* World Map Background */}
      <WorldMapBackground />

      <div className="relative max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10"
          >
            {/* Badge */}
            <motion.div variants={itemVariants} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-lg border border-blue-100 text-sm font-medium text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Network Intelligence Platform
              </span>
            </motion.div>

            {/* Main heading */}
            <motion.h1 
              variants={itemVariants}
              className="text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-[1.1]"
            >
              See Your{' '}
              <span className="gradient-text">Network</span>
              <br />
              Like Never Before
            </motion.h1>

            {/* Description */}
            <motion.p 
              variants={itemVariants}
              className="text-xl text-slate-600 mb-8 max-w-lg leading-relaxed"
            >
              Automatically discover, map, and visualize your FortiGate infrastructure across all your global locations.
            </motion.p>

            {/* Benefits list */}
            <motion.div variants={itemVariants} className="space-y-3 mb-10">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <span className="font-medium">{benefit}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a 
                href="#dashboard"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 btn-shine"
              >
                Try Demo
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a 
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg transition-all hover:scale-105 hover:border-slate-300 shadow-lg"
              >
                <Play className="w-5 h-5" />
                See How It Works
              </a>
            </motion.div>

            {/* Trust indicators */}
            <motion.div 
              variants={itemVariants}
              className="mt-12 pt-8 border-t border-slate-200/60"
            >
              <p className="text-sm text-slate-500 mb-4">Trusted by network engineers worldwide</p>
              <div className="flex items-center gap-8 opacity-50">
                {['Enterprise', 'TechCorp', 'NetSystems', 'DataFlow'].map((company, i) => (
                  <span key={i} className="text-lg font-bold text-slate-400">{company}</span>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right - App Preview (ripristinato) */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative z-10"
          >
            {/* Main app window */}
            <div className="relative bg-white rounded-3xl shadow-2xl shadow-slate-300/50 border border-slate-200 overflow-hidden">
              {/* Window header */}
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-slate-400 font-medium">Sauron Dashboard</span>
                </div>
              </div>

              {/* App content */}
              <div className="p-6">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Firewalls', value: '12', change: '+2', color: 'blue' },
                    { label: 'VDOMs', value: '48', change: '+5', color: 'purple' },
                    { label: 'Routes', value: '1.2k', change: '+124', color: 'emerald' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">{stat.label}</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                        <span className={`text-xs font-semibold text-${stat.color}-600 mb-1`}>{stat.change}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Topology preview */}
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 h-64 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-700">Network Topology</span>
                    <span className="text-xs text-slate-400">Live View</span>
                  </div>
                  
                  {/* Animated nodes */}
                  <div className="relative h-full">
                    {/* Central hub */}
                    <motion.div 
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 z-10"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <Shield className="w-7 h-7 text-white" />
                    </motion.div>

                    {/* Satellite nodes */}
                    {[
                      { x: '20%', y: '20%', color: 'bg-emerald-500', delay: 0 },
                      { x: '80%', y: '25%', color: 'bg-purple-500', delay: 0.5 },
                      { x: '75%', y: '75%', color: 'bg-amber-500', delay: 1 },
                      { x: '15%', y: '70%', color: 'bg-rose-500', delay: 1.5 }
                    ].map((node, i) => (
                      <motion.div
                        key={i}
                        className={`absolute w-10 h-10 ${node.color} rounded-lg flex items-center justify-center shadow-lg`}
                        style={{ left: node.x, top: node.y }}
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: node.delay }}
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </motion.div>
                    ))}

                    {/* Connection lines SVG */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <motion.path
                        d="M 50% 50% L 20% 20%"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <motion.path
                        d="M 50% 50% L 80% 25%"
                        stroke="#8b5cf6"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                      />
                      <motion.path
                        d="M 50% 50% L 75% 75%"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                      />
                      <motion.path
                        d="M 50% 50% L 15% 70%"
                        stroke="#f43f5e"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.9 }}
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating status cards */}
            <motion.div 
              className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl shadow-slate-300/50 border border-slate-100 p-4 flex items-center gap-3"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">System Status</p>
                <p className="text-sm font-bold text-slate-900">All Online</p>
              </div>
            </motion.div>

            <motion.div 
              className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl shadow-slate-300/50 border border-slate-100 p-4"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              <p className="text-xs text-slate-500 font-medium mb-1">Last Scan</p>
              <p className="text-lg font-bold text-slate-900">2m ago</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
