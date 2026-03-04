import React from 'react';
import { motion } from 'framer-motion';

interface CategorySummaryProps {
    dimensions: Record<string, number | null>;
}

const CATEGORIES: Record<string, string[]> = {
    'Market': ['TAM Viability', 'Target Precision', 'Trend Adoption', 'Team / Founder Strength'],
    'Strategy': ['Competitive Defensibility', 'Model Innovation', 'Flywheel Potential', 'Network Effects Strength', 'Data Asset Quality'],
    'Commercial': ['Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed'],
    'Operations': ['Execution Speed', 'Scalability', 'ESG Posture', 'Regulatory Readiness'],
    'Finance': ['ROI Projection', 'Risk Tolerance', 'Capital Efficiency', 'Customer Concentration Risk'],
};

export const CategorySummary: React.FC<CategorySummaryProps> = ({ dimensions }) => {
    const categoryAverages = Object.entries(CATEGORIES).map(([cat, dims]) => {
        const scores = dims.map(d => dimensions[d]).filter((v): v is number => v !== null && v !== undefined);
        const avg = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;
        return { name: cat, avg };
    });

    const getScoreColor = (score: number) => {
        if (score >= 70) return '#10b981'; // emerald-500
        if (score >= 40) return '#3b82f6'; // blue-500
        return '#f43f5e'; // rose-500
    };

    return (
        <div className="w-full max-w-7xl mx-auto mb-8 border-y border-white/5 py-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between min-w-[600px] px-2">
                {categoryAverages.map((cat, idx) => (
                    <motion.div
                        key={cat.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex flex-col items-center gap-1 px-6 border-r last:border-r-0 border-white/5"
                    >
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{cat.name} Index</span>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-white">
                                {cat.avg}<span className="text-[10px] text-zinc-600 ml-0.5">/100</span>
                            </div>
                            <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${cat.avg}%` }}
                                    transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                                    style={{ background: getScoreColor(cat.avg) }}
                                    className="h-full"
                                />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
