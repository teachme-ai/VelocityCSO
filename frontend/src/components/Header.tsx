import { motion } from 'framer-motion';

export function Header() {
    return (
        <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-8 py-5"
            style={{ background: 'linear-gradient(to bottom, rgba(5,8,20,0.9) 0%, transparent 100%)' }}
        >
            <div className="flex items-center gap-3">
                {/* Resilient Shield Icon */}
                <div className="w-8 h-8">
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        <defs>
                            <filter id="glow-header" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <linearGradient id="blue_grad_header" x1="25" y1="20" x2="25" y2="80" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#1e3a8a" />
                                <stop offset="100%" stop-color="#1e40af" />
                            </linearGradient>
                            <linearGradient id="green_grad_header" x1="75" y1="20" x2="75" y2="80" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#10b981" />
                                <stop offset="100%" stop-color="#22c55e" />
                            </linearGradient>
                        </defs>

                        {/* Outer Glow */}
                        <path d="M50 15 L20 25 C20 25 20 65 50 85 C80 65 80 25 80 25 L50 15 Z"
                            fill="none" stroke="#22c55e" stroke-width="4" opacity="0.3" filter="url(#glow-header)" />

                        {/* Shield Left */}
                        <path d="M50 15 L20 25 C20 25 20 65 50 85 L50 15 Z" fill="url(#blue_grad_header)" />

                        {/* Shield Right */}
                        <path d="M50 15 L80 25 C80 25 80 65 50 85 L50 15 Z" fill="url(#green_grad_header)" />

                        {/* Purple Intersection (The 'Asymmetric Advantage') with Pulsating Glow */}
                        <path
                            d="M40 35 L50 25 L60 35 L50 80 L40 35 Z"
                            fill="#a855f7"
                            className="pulse-overlap"
                            style={{ filter: 'url(#glow-header)' }}
                        />
                    </svg>
                </div>

                <span className="font-bold text-white text-sm tracking-wide" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    VELOCITY CSO
                </span>
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
