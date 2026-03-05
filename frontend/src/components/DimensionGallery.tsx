import { motion } from 'framer-motion';
import {
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

const CATEGORIES = [
    {
        name: 'Market',
        color: '#a78bfa',
        score: 73,
        dimensions: [
            { name: 'TAM Viability', score: 85 },
            { name: 'Target Precision', score: 42 },
            { name: 'Trend Adoption', score: 92 },
        ],
    },
    {
        name: 'Strategy',
        color: '#818cf8',
        score: 59,
        dimensions: [
            { name: 'Competitive Defensibility', score: 38 },
            { name: 'Model Innovation', score: 77 },
            { name: 'Flywheel Potential', score: 61 },
        ],
    },
    {
        name: 'Commercial',
        color: '#34d399',
        score: 59,
        dimensions: [
            { name: 'Pricing Power', score: 88 },
            { name: 'CAC/LTV Ratio', score: 55 },
            { name: 'Market Entry Speed', score: 33 },
        ],
    },
    {
        name: 'Operations',
        color: '#6ee7b7',
        score: 72,
        dimensions: [
            { name: 'Execution Speed', score: 72 },
            { name: 'Scalability', score: 49 },
            { name: 'ESG Posture', score: 95 },
        ],
    },
    {
        name: 'Finance',
        color: '#fbbf24',
        score: 58,
        dimensions: [
            { name: 'ROI Projection', score: 28 },
            { name: 'Risk Tolerance', score: 66 },
            { name: 'Capital Efficiency', score: 81 },
        ],
    },
];

const radarData = CATEGORIES.map(c => ({ category: c.name, score: c.score }));

function scoreColor(score: number) {
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#2563eb';
    return '#dc2626';
}

function scoreLabel(score: number) {
    if (score >= 70) return 'Healthy';
    if (score >= 40) return 'Developing';
    return 'Critical';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        const cat = CATEGORIES.find(c => c.name === d.category);
        return (
            <div className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs">
                <p className="text-white font-semibold mb-1">{d.category}</p>
                <p style={{ color: cat?.color }}>{d.score} / 100</p>
            </div>
        );
    }
    return null;
};

export const DimensionGallery = () => {
    return (
        <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-16 w-full">
            {/* Radar Chart */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="w-full lg:w-[420px] flex-shrink-0"
            >
                <div className="relative">
                    {/* Glow ring behind chart */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 rounded-full bg-violet-600/10 blur-[60px]" />
                    </div>
                    <ResponsiveContainer width="100%" height={360}>
                        <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                            <PolarGrid
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth={1}
                            />
                            <PolarAngleAxis
                                dataKey="category"
                                tick={{ fill: '#a1a1aa', fontSize: 12, fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif' }}
                                tickLine={false}
                            />
                            <Radar
                                name="Score"
                                dataKey="score"
                                stroke="#a78bfa"
                                strokeWidth={2}
                                fill="#7c3aed"
                                fillOpacity={0.15}
                                dot={{ fill: '#a78bfa', r: 4, strokeWidth: 0 }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>64</div>
                            <div className="text-[9px] tracking-[0.2em] uppercase text-gray-500 mt-0.5">Overall</div>
                        </div>
                    </div>
                </div>
                <p className="text-center text-[10px] tracking-[0.3em] uppercase text-gray-600 mt-2">
                    Sample Audit — Demo Scores
                </p>
            </motion.div>

            {/* Category Sidebar */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 lg:gap-5">
                {CATEGORIES.map((cat, ci) => (
                    <motion.div
                        key={cat.name}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: ci * 0.08, duration: 0.5 }}
                        viewport={{ once: true }}
                    >
                        {/* Category header */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color, boxShadow: `0 0 8px ${cat.color}` }} />
                            <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: cat.color, fontFamily: 'Space Grotesk, sans-serif' }}>
                                {cat.name}
                            </span>
                            <div className="flex-1 h-px bg-white/5" />
                            <span className="text-xs font-mono text-white/60">{cat.score}</span>
                        </div>

                        {/* Dimension rows */}
                        <div className="space-y-1.5 pl-4">
                            {cat.dimensions.map((dim) => (
                                <div key={dim.name} className="flex items-center gap-3">
                                    <span className="text-[11px] text-gray-400 w-40 flex-shrink-0 truncate">{dim.name}</span>
                                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            whileInView={{ width: `${dim.score}%` }}
                                            transition={{ delay: ci * 0.08 + 0.2, duration: 0.6, ease: 'easeOut' }}
                                            viewport={{ once: true }}
                                            className="h-full rounded-full"
                                            style={{ backgroundColor: scoreColor(dim.score) }}
                                        />
                                    </div>
                                    <span
                                        className="text-[9px] font-bold uppercase tracking-wide w-16 text-right flex-shrink-0"
                                        style={{ color: scoreColor(dim.score) }}
                                    >
                                        {scoreLabel(dim.score)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
