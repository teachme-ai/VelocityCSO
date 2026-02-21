import './index.css';
import { HeroSection } from './components/HeroSection';
import { DimensionOrbit } from './components/DimensionOrbit';
import { PricingSection } from './components/PricingSection';
import { motion } from 'framer-motion';

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-violet-400" />
          <span className="font-semibold text-white text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Velocity CSO
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <p className="text-xs text-gray-600">
          © 2026 VelocityCSO. McKinsey-grade strategy intelligence, powered by agentic AI.
        </p>
        <div className="flex gap-6 text-xs text-gray-600">
          <a href="#" className="hover:text-gray-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Terms</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="relative min-h-screen bg-[#050814]">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-5"
        style={{ background: 'linear-gradient(to bottom, rgba(5,8,20,0.9) 0%, transparent 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            VELOCITY CSO
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#engine" className="hover:text-white transition-colors">The Engine</a>
          <a href="#offerings" className="hover:text-white transition-colors">Offerings</a>
        </div>
        <a href="#audit"
          className="text-xs font-semibold px-5 py-2 rounded-lg transition-all duration-300 hover:opacity-90"
          style={{
            background: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.4)',
            color: '#a78bfa',
            fontFamily: 'Space Grotesk, sans-serif'
          }}
        >
          Start Audit →
        </a>
      </motion.nav>

      {/* Main Sections */}
      <HeroSection />
      <div id="engine">
        <DimensionOrbit />
      </div>
      <div id="offerings">
        <PricingSection />
      </div>
      <Footer />
    </div>
  );
}
