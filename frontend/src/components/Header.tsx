import { motion } from 'framer-motion';
import VelocityLogo from '../assets/VelocityCSO_logo_v4.png';

export function Header() {
    return (
        <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 backdrop-blur-md"
            style={{ background: 'linear-gradient(to bottom, rgba(5,8,20,0.9) 0%, transparent 100%)' }}
        >
            <div className="flex items-center gap-3">
                {/* Official VelocityCSO Logo */}
                <div className="relative group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img
                        src={VelocityLogo}
                        alt="VelocityCSO"
                        className="h-14 w-auto object-contain rounded-sm"
                    />
                    {/* Subtle Pulsating Glow behind the logo */}
                    <motion.div
                        className="absolute inset-x-0 -inset-y-2 bg-violet-500/10 blur-2xl -z-10 rounded-full"
                        animate={{
                            opacity: [0.1, 0.3, 0.1],
                            scale: [1, 1.2, 1]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
                <a href="#engine" className="hover:text-white transition-colors">The Engine</a>
                <a href="#offerings" className="hover:text-white transition-colors">Offerings</a>
                <a href="/report/sample?token=00sample" className="hover:text-white transition-colors text-violet-400">Sample Report</a>
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
    );
}
