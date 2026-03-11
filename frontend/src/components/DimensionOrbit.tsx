import { motion } from 'framer-motion';
import { DimensionGallery } from './DimensionGallery';

const CAPABILITIES = [
    {
        icon: '⬡',
        title: '7 Live Frameworks',
        desc: 'Porter · Ansoff · VRIO · Blue Ocean · Wardley · Monte Carlo — all run in parallel, not in sequence.',
        color: '#a78bfa',
    },
    {
        icon: '⚡',
        title: '5 Crisis Scenarios',
        desc: 'Recession · Funding drought · Competitive attack · Regulatory shock · Supply chain collapse.',
        color: '#f59e0b',
    },
    {
        icon: '🧠',
        title: 'Critic AI Layer',
        desc: 'Every finding is reviewed by a second model before you see it. No hallucinations passed through.',
        color: '#34d399',
    },
    {
        icon: '🗺',
        title: '90-Day Action Roadmap',
        desc: 'Prioritised by impact. Assigned by role. Not a list of observations — a plan you can act on Monday.',
        color: '#60a5fa',
    },
    {
        icon: '📄',
        title: 'Board-Ready PDF — Free',
        desc: 'Every audit generates a full PDF report. Download it, share it, present it. No paywall.',
        color: '#f472b6',
    },
];

export function DimensionOrbit() {
    return (
        <section id="engine" className="relative py-24 bg-[#050814] overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-30 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-violet-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">

                {/* Header */}
                <div className="text-center mb-14">
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                        className="text-xs tracking-[0.4em] uppercase text-violet-400 mb-4 font-bold"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                        The Diagnostic Engine
                    </motion.p>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                        Where Is Your Strategy
                        <br />
                        <span className="text-gradient-main">Exposed?</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
                    >
                        20 diagnostic checks. 5 categories. Most teams uncover 3–5 critical blind spots
                        they weren't tracking — ranked, explained, and mapped to a 90-day action plan.
                    </motion.p>
                </div>

                {/* Capabilities Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-20">
                    {CAPABILITIES.map((cap, i) => (
                        <motion.div
                            key={cap.title}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07, duration: 0.5 }}
                            viewport={{ once: true }}
                            className="rounded-xl p-4 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300 group cursor-default"
                        >
                            <div className="text-2xl mb-3">{cap.icon}</div>
                            <div
                                className="text-sm font-bold mb-2 leading-snug"
                                style={{ color: cap.color, fontFamily: 'Space Grotesk, sans-serif' }}
                            >
                                {cap.title}
                            </div>
                            <div className="text-[11px] text-gray-500 leading-relaxed group-hover:text-gray-400 transition-colors duration-200">
                                {cap.desc}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Dimension Gallery */}
                <DimensionGallery />

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    viewport={{ once: true }}
                    className="mt-16 text-center"
                >
                    <p className="text-gray-500 text-sm mb-5">
                        Takes ~6 minutes. Free PDF report included — no sign-up required.
                    </p>
                    <a
                        href="#"
                        onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-white transition-all duration-300"
                        style={{
                            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                            boxShadow: '0 0 32px rgba(124,58,237,0.35)',
                            fontFamily: 'Space Grotesk, sans-serif',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 48px rgba(124,58,237,0.55)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 32px rgba(124,58,237,0.35)')}
                    >
                        Run your free audit
                        <span className="text-violet-300">→</span>
                    </a>
                </motion.div>

            </div>
        </section>
    );
}
