import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Star, AlertTriangle, ShieldCheck } from 'lucide-react';

import type { RichDimensionData } from '../DiagnosticScorecard';

interface KpiRowProps {
    dimensions: Record<string, number | null>;
    richDimensions?: Record<string, RichDimensionData>;
}

export const KpiRow: React.FC<KpiRowProps> = ({ dimensions, richDimensions }) => {
    const dimValues = Object.values(dimensions).filter((v): v is number => v !== null && v !== undefined);
    const overallScore = dimValues.length > 0
        ? Math.round(dimValues.reduce((a, b) => a + b, 0) / dimValues.length)
        : 0;

    const availableEntries = Object.entries(dimensions).filter((entry): entry is [string, number] => entry[1] !== null && entry[1] !== undefined);
    const topStrength = [...availableEntries].sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];
    const keyRisk = [...availableEntries].sort((a, b) => a[1] - b[1])[0] || ['N/A', 0];

    const richDims = Object.values(richDimensions || {});
    const confidence = richDims.length > 0
        ? Math.round(richDims.reduce((a, b) => a + (b.confidence_score || 0), 0) / richDims.length)
        : 85; // Default if no rich data

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-400';
        if (score >= 40) return 'text-blue-400';
        return 'text-rose-400';
    };

    const getScoreBg = (score: number) => {
        if (score >= 70) return 'bg-emerald-500/10 border-emerald-500/20';
        if (score >= 40) return 'bg-blue-500/10 border-blue-500/20';
        return 'bg-rose-500/10 border-rose-500/20';
    };

    const kpis = [
        {
            label: 'Strategy Health',
            value: `${overallScore}/100`,
            subValue: 'Aggregate Performance',
            icon: Activity,
            color: getScoreColor(overallScore),
            bg: getScoreBg(overallScore)
        },
        {
            label: 'Top Strength',
            value: topStrength[0],
            subValue: `Peak Edge: ${topStrength[1]}`,
            icon: Star,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20'
        },
        {
            label: 'Key Risk',
            value: keyRisk[0],
            subValue: `Exposure: ${keyRisk[1]}`,
            icon: AlertTriangle,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10 border-rose-500/20'
        },
        {
            label: 'Analysis Confidence',
            value: `${confidence}%`,
            subValue: 'Specialist Consensus',
            icon: ShieldCheck,
            color: 'text-violet-400',
            bg: 'bg-violet-500/10 border-violet-500/20'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-7xl mx-auto mb-8">
            {kpis.map((kpi, idx) => (
                <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-4 rounded-xl border backdrop-blur-md ${kpi.bg} transition-all duration-300 hover:scale-[1.02]`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg bg-white/5`}>
                            <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{kpi.label}</span>
                    </div>
                    <div>
                        <div className={`text-lg font-bold truncate ${kpi.color}`}>
                            {kpi.value}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                            {kpi.subValue}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
