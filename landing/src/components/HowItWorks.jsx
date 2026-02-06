import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const steps = [
  {
    step: '01',
    title: 'Connect',
    description: 'Add your FortiGate firewalls using API credentials. Sauron supports multiple firewalls and VDOMs out of the box.',
    action: 'Import inventory'
  },
  {
    step: '02',
    title: 'Discover',
    description: 'Run a network scan to automatically discover interfaces, routes, policies, and topology across all your devices.',
    action: 'Start scanning'
  },
  {
    step: '03',
    title: 'Visualize',
    description: 'Explore your network through interactive topology maps, detailed inventory views, and real-time dashboards.',
    action: 'View topology'
  },
  {
    step: '04',
    title: 'Simulate',
    description: 'Test packet paths, verify connectivity, and troubleshoot issues without impacting production traffic.',
    action: 'Run simulation'
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="relative py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div 
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-semibold text-slate-700 mb-6">
            Simple Process
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 mb-6">
            Get Started in{' '}
            <span className="gradient-text">Minutes</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            No complex configuration. Just connect your firewalls and let Sauron do the rest.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-blue-200 to-transparent" />
              )}
              
              <div className="bg-white rounded-3xl p-8 shadow-lg shadow-slate-200/50 border border-slate-100 h-full hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 group">
                {/* Step number */}
                <div className="text-5xl font-black text-blue-100 mb-6 group-hover:text-blue-200 transition-colors">
                  {item.step}
                </div>
                
                {/* Content */}
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {item.description}
                </p>
                
                {/* Action link */}
                <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                  <span>{item.action}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.div 
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-lg shadow-slate-200/50 border border-slate-100">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-slate-700 font-medium">No agents to install. No network changes required.</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
