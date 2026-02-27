import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const dimensions = [
    { name: 'TAM Viability', category: 'Market', color: '#a78bfa' },
    { name: 'Target Precision', category: 'Market', color: '#a78bfa' },
    { name: 'Trend Adoption', category: 'Market', color: '#a78bfa' },
    { name: 'Competitive Defensibility', category: 'Strategy', color: '#818cf8' },
    { name: 'Model Innovation', category: 'Strategy', color: '#818cf8' },
    { name: 'Flywheel Potential', category: 'Strategy', color: '#818cf8' },
    { name: 'Pricing Power', category: 'Commercial', color: '#34d399' },
    { name: 'CAC/LTV Ratio', category: 'Commercial', color: '#34d399' },
    { name: 'Market Entry Speed', category: 'Commercial', color: '#34d399' },
    { name: 'Execution Speed', category: 'Operations', color: '#6ee7b7' },
    { name: 'Scalability', category: 'Operations', color: '#6ee7b7' },
    { name: 'ESG Posture', category: 'Operations', color: '#6ee7b7' },
    { name: 'ROI Projection', category: 'Finance', color: '#fbbf24' },
    { name: 'Risk Tolerance', category: 'Finance', color: '#fbbf24' },
    { name: 'Capital Efficiency', category: 'Finance', color: '#fbbf24' },
];

function useWindowSize() {
    const [size, setSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1200 });
    useEffect(() => {
        const handleResize = () => setSize({ width: window.innerWidth });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return size;
}

export const DimensionGallery = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { width } = useWindowSize();

    // Responsive configuration
    const isMobile = width < 640;
    const isTablet = width >= 640 && width < 1024;

    const cols = isMobile ? 2 : (isTablet ? 3 : 5);
    const rowHeight = isMobile ? 120 : 140;
    const containerHeight = Math.ceil(dimensions.length / cols) * rowHeight + 100;

    const dimensionData = dimensions.map((dim: { name: string; category: string; color: string }, i: number) => {
        const row = Math.floor(i / cols);
        const col = i % cols;

        // Base grid position (%)
        const colWidth = 100 / cols;
        const baseX = (col * colWidth) + (colWidth / 2);
        const baseY = (row * rowHeight) + (rowHeight / 2);

        // Deterministic jitter based on index
        const jitterX = ((i * 13) % 8) - 4;
        const jitterY = ((i * 17) % 8) - 4;

        // Sample Audit Scores (deterministic for demo)
        const scores = [85, 42, 92, 38, 77, 61, 88, 55, 33, 72, 49, 95, 28, 66, 81];
        const score = scores[i % scores.length];

        // Health Color Logic
        let healthColor = '#16a34a'; // Green (Healthy)
        if (score < 40) healthColor = '#dc2626'; // Red (Critical)
        else if (score < 70) healthColor = '#2563eb'; // Blue (Developing)

        return {
            ...dim,
            left: `calc(${baseX}% + ${jitterX}px)`,
            top: `${baseY + jitterY}px`,
            animationDuration: 4 + ((i * 7) % 3),
            animationDelay: (i * 0.3) % 2,
            score,
            healthColor
        };
    });

    return (
        <div
            ref={containerRef}
            className="relative w-full mt-6 md:mt-12 overflow-hidden px-4 md:px-0"
            style={{ height: `${containerHeight}px` }}
        >
            {dimensionData.map((dim: any, i: number) => {
                return (
                    <motion.div
                        key={dim.name}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{
                            opacity: 1,
                            scale: 1,
                            transition: {
                                delay: (i % cols) * 0.1 + Math.floor(i / cols) * 0.1,
                                duration: 0.6,
                                ease: "easeOut"
                            }
                        }}
                        viewport={{ once: true }}
                        animate={{
                            y: [0, -10, 0],
                            x: [0, 5, 0],
                            transition: {
                                duration: dim.animationDuration,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: dim.animationDelay
                            }
                        }}
                        className="dimension-orb absolute flex flex-col items-center justify-center text-center cursor-default group"
                        style={{
                            left: dim.left,
                            top: dim.top,
                            transform: 'translate(-50%, -50%)',
                            '--health-color': dim.healthColor,
                            width: isMobile ? '140px' : '180px'
                        } as React.CSSProperties}
                    >
                        <motion.div
                            animate={{
                                opacity: [0.6, 1, 0.6],
                                scale: [1, 1.15, 1],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.2
                            }}
                            className="w-2.5 h-2.5 rounded-full mb-2 shadow-[0_0_15px_var(--health-color)]"
                            style={{ backgroundColor: dim.healthColor } as React.CSSProperties}
                        />
                        <h4 className="text-white font-bold text-[10px] md:text-[13px] tracking-tight mb-0.5 group-hover:text-violet-300 transition-colors leading-tight">
                            {dim.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[9px] font-mono text-white/90 bg-white/10 px-1.5 rounded border border-white/5">
                                {dim.score}
                            </span>
                            <span className="text-[8px] uppercase tracking-[0.1em] text-gray-500 font-bold">
                                {dim.category}
                            </span>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};
