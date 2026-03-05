import { motion } from 'framer-motion';
import VelocityRocket from '../assets/vcso_rocket_logo.png';

export function Header() {
    return (
        <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-3 backdrop-blur-md"
            style={{
                background: 'rgba(5,8,20,0.85)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
        >
            {/* Left: Logo */}
            <div
                className="relative group cursor-pointer flex-shrink-0"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
                <img
                    src={VelocityRocket}
                    alt="VelocityCSO"
                    className="h-12 w-auto object-contain"
                    loading="eager"
                    fetchPriority="high"
                />
                <motion.div
                    className="absolute inset-x-0 -inset-y-2 bg-violet-500/10 blur-2xl -z-10 rounded-full"
                    animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            {/* Right: Nav links + CTA */}
            <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-7 text-sm text-gray-400">
                    <a href="#engine" className="hover:text-white transition-colors duration-200 tracking-wide">The Engine</a>
                    <a href="#offerings" className="hover:text-white transition-colors duration-200 tracking-wide">Offerings</a>
                    <a
                        href="/report/sample?token=00sample"
                        className="transition-colors duration-200 tracking-wide"
                        style={{ color: '#a78bfa' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#a78bfa')}
                    >
                        Sample Report
                    </a>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-4 bg-white/10" />

                <a
                    href="#audit"
                    className="text-xs font-semibold px-5 py-2 rounded-lg transition-all duration-300 hover:opacity-90 whitespace-nowrap"
                    style={{
                        background: 'rgba(124,58,237,0.2)',
                        border: '1px solid rgba(124,58,237,0.4)',
                        color: '#a78bfa',
                        fontFamily: 'Space Grotesk, sans-serif',
                    }}
                >
                    Start Audit →
                </a>
            </div>
        </motion.nav>
    );
}
