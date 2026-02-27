import './index.css';
import { HeroSection } from './components/HeroSection';
import { DimensionOrbit } from './components/DimensionOrbit';
import { PricingSection } from './components/PricingSection';
import { Header } from './components/Header';

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
      <Header />

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
