import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { 
  Network, 
  Route, 
  Eye, 
  Zap, 
  Shield, 
  Clock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

const features = [
  {
    icon: Network,
    title: 'Automatic Discovery',
    description: 'Connect to your FortiGate firewalls and automatically discover VDOMs, interfaces, routes, and policies across your entire infrastructure in minutes.',
    benefits: ['Multi-firewall scanning', 'VDOM detection', 'Interface mapping'],
    color: 'blue',
    stat: '5x faster'
  },
  {
    icon: Eye,
    title: 'Visual Topology',
    description: 'See your complete network topology in an interactive diagram. Zoom, pan, and explore connections between firewalls, VDOMs, and subnets.',
    benefits: ['Interactive diagram', 'Real-time updates', 'Export to PNG/SVG'],
    color: 'purple',
    stat: '100% visibility'
  },
  {
    icon: Route,
    title: 'Path Simulation',
    description: 'Test connectivity and routing without leaving your desk. Simulate packet paths between any two points and identify bottlenecks or misconfigurations.',
    benefits: ['LPM simulation', 'Dijkstra algorithm', 'Multi-path analysis'],
    color: 'emerald',
    stat: 'Zero downtime'
  },
  {
    icon: Zap,
    title: 'Real-time Monitoring',
    description: 'Monitor firewall health, latency, and reachability in real-time. Get instant alerts when issues arise and track performance over time.',
    benefits: ['Health checks', 'Latency tracking', 'Status alerts'],
    color: 'amber',
    stat: '< 1s updates'
  },
  {
    icon: Shield,
    title: 'Security Insights',
    description: 'Analyze firewall policies, address objects, and routing tables. Identify unused rules, overlapping subnets, and potential security gaps.',
    benefits: ['Policy analysis', 'Object inventory', 'Security audit'],
    color: 'rose',
    stat: 'Full audit'
  },
  {
    icon: Clock,
    title: 'Snapshot History',
    description: 'Save network snapshots and compare configurations over time. Track changes, rollback when needed, and maintain a complete audit trail.',
    benefits: ['Version control', 'Change tracking', 'Quick rollback'],
    color: 'cyan',
    stat: 'Full history'
  }
];

const FeatureCard = ({ feature, index }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5], [60, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1]);

  const Icon = feature.icon;
  const isEven = index % 2 === 0;

  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/25',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/25',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/25',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/25',
    rose: 'from-rose-500 to-rose-600 shadow-rose-500/25',
    cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-500/25',
  };

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y, scale }}
      className={`grid lg:grid-cols-2 gap-12 items-center ${isEven ? '' : 'lg:flex-row-reverse'}`}
    >
      {/* Visual */}
      <div className={`${isEven ? 'lg:order-1' : 'lg:order-2'}`}>
        <div className="relative group">
          {/* Background glow */}
          <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[feature.color]} opacity-10 blur-3xl rounded-full group-hover:opacity-20 transition-opacity duration-500`} />
          
          {/* Card */}
          <div className="relative bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:shadow-slate-200/60 transition-all duration-500">
            <div className="flex items-start justify-between mb-6">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorClasses[feature.color]} flex items-center justify-center shadow-lg`}>
                <Icon className="w-8 h-8 text-white" />
              </div>
              <span className={`px-4 py-2 rounded-full bg-${feature.color}-50 text-${feature.color}-700 text-sm font-bold`}>
                {feature.stat}
              </span>
            </div>
            
            {/* Mock UI element */}
            <div className="space-y-3">
              <div className="h-3 bg-slate-100 rounded-full w-3/4" />
              <div className="h-3 bg-slate-100 rounded-full w-1/2" />
              <div className="flex gap-2 mt-4">
                <div className={`h-8 flex-1 bg-${feature.color}-100 rounded-lg`} />
                <div className="h-8 w-8 bg-slate-100 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${isEven ? 'lg:order-2' : 'lg:order-1'} text-center lg:text-left`}>
        <span className={`inline-block px-3 py-1 rounded-full bg-${feature.color}-50 text-${feature.color}-700 text-sm font-bold uppercase tracking-wider mb-4`}>
          Feature {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
          {feature.title}
        </h3>
        <p className="text-lg text-slate-600 mb-6 leading-relaxed">
          {feature.description}
        </p>
        
        {/* Benefits */}
        <ul className="space-y-3 mb-8">
          {feature.benefits.map((benefit, i) => (
            <li key={i} className="flex items-center gap-3 justify-center lg:justify-start">
              <CheckCircle2 className={`w-5 h-5 text-${feature.color}-500 flex-shrink-0`} />
              <span className="text-slate-700 font-medium">{benefit}</span>
            </li>
          ))}
        </ul>

        <button className={`inline-flex items-center gap-2 text-${feature.color}-600 font-bold hover:gap-3 transition-all`}>
          Learn more <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

const Features = () => {
  return (
    <section id="features" className="relative py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-24"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-sm font-semibold text-slate-700 mb-6">
            Powerful Capabilities
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 mb-6">
            Everything You Need to{' '}
            <span className="gradient-text">Manage</span> Your Network
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            From automatic discovery to visual troubleshooting, Sauron gives you complete 
            visibility and control over your FortiGate infrastructure.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="space-y-32">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
