import { motion } from 'framer-motion';
import { DimensionGallery } from './DimensionGallery';

export function DimensionOrbit() {
    return (
        <section className="relative py-24 bg-[#050814] overflow-hidden">
            {/* Background Decorative Element */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-30 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-violet-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center mb-16 md:mb-24">
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
                        className="text-4xl md:text-7xl font-bold text-white mb-8 tracking-tight"
                        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                        Full-Spectrum<br />
                        <span className="text-gradient-main">Strategy Intelligence.</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.8 }}
                        className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
                    >
                        Five categories. Fifteen dimensions. Every blind spot surfaced — so your strategy
                        is built on intelligence, not assumption.
                    </motion.p>
                </div>

                {/* The Constellation Gallery */}
                <DimensionGallery />
            </div>
        </section>
    );
}
