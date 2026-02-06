import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap, Clock } from 'lucide-react';

const CTA = () => {
  return (
    <section className="relative py-32 bg-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-100/50 rounded-full blur-3xl" />
      
      <div className="relative max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Icon */}
          <motion.div 
            className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-xl shadow-blue-500/30 mb-8"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>

          {/* Heading */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 mb-6">
            Ready to See Your{' '}
            <span className="gradient-text">Network?</span>
          </h2>

          {/* Description */}
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            Get complete visibility into your FortiGate infrastructure. 
            Start discovering, visualizing, and troubleshooting in minutes.
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {[
              { icon: Zap, text: 'Free to use' },
              { icon: Clock, text: 'Setup in 5 minutes' },
              { icon: Shield, text: 'Self-hosted' },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="flex items-center gap-2 text-slate-600">
                  <Icon className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">{item.text}</span>
                </div>
              );
            })}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a 
              href="#dashboard"
              className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-xl shadow-blue-500/25"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Try the Demo
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.a>
            <motion.a 
              href="https://github.com"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg transition-all hover:scale-105"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              View on GitHub
            </motion.a>
          </div>

          {/* Note */}
          <p className="mt-8 text-sm text-slate-500">
            Open source and free forever. No credit card required.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
