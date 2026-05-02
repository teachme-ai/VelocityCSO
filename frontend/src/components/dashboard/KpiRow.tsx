import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Star, AlertTriangle, ShieldCheck } from 'lucide-react';

import type { RichDimensionData } from '../DiagnosticScorecard';

// Dimensions that represent risk absence — high score = low risk, not a strength
const RISK_DIMENSIONS = new Set([
    'Customer Concentration Risk',
    'Risk Tolerance',
]);

// Dimensions that are operationally important but not primary strategic moat signals
const LOW_MATERIALITY = new Set([
    'ESG Posture',
    'Scalability',
    'ROI Projection',
    'Capital Efficiency',
    'Network Effects Strength',
    'Market Entry Speed',
    'Target Precision',
    'CAC/LTV Ratio',
    'Team / Founder Strength',
    'Execution Speed',
]);

// Dimensions that are genuinely material strategic risks when they score low
const STRATEGIC_RISK_PRIORITY = new Set([
    'Competitive Defensibility',
    'Regulatory Readiness',
    'Data Asset Quality',
    'Flywheel Potential',
    'Trend Adoption',
    'Pricing Power',
    'TAM Viability',
    'Model Innovation',
]);

interface SpecialistMeta {
    agent: string;
    confidence_score: number | null;
    data_sources: string[];
    missing_signals: string[];
}

interface ConfidenceTriad {
    evidenceConfidence: number;
    analyticalConfidence: number;
    decisionConfidence: number;
}

interface KpiRowProps {
    dimensions: Record<string, number | null>;
    richDimensions?: Record<string, RichDimensionData>;
    specialistMetadata?: SpecialistMeta[];
    confidenceTriad?: ConfidenceTriad;
}

export const KpiRow: React.FC<KpiRowProps> = ({ dimensions, richDimensions, specialistMetadata, confidenceTriad }) => {
    const dimValues = Object.values(dimensions).filter((v): v is number => v !== null && v !== undefined);
    const overallScore = dimValues.length > 0
        ? Math.round(dimValues.reduce((a, b) => a + b, 0) / dimValues.length)
        : 0;

    const availableEntries = Object.entries(dimensions).filter((entry): entry is [string, number] => entry[1] !== null && entry[1] !== undefined);

    // Top strength — exclude risk-absence dimensions
    const topStrength = [...availableEntries]
        .filter(([k]) => !RISK_DIMENSIONS.has(k))
        .sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

    // Most material risk — priority order:
    // 1. STRATEGIC_RISK_PRIORITY dimensions scoring < 50
    // 2. Any non-risk-absence, non-low-materiality dimension scoring < 50
    // 3. Fallback to lowest scoring non-risk-absence dimension
    const weakDims = availableEntries.filter(([, v]) => v < 50);
    const priorityWeak = weakDims
        .filter(([k]) => STRATEGIC_RISK_PRIORITY.has(k))
        .sort((a, b) => a[1] - b[1]);
    const strategicWeak = weakDims
        .filter(([k]) => !RISK_DIMENSIONS.has(k) && !LOW_MATERIALITY.has(k))
        .sort((a, b) => a[1] - b[1]);
    const keyRisk = priorityWeak[0]
        || strategicWeak[0]
        || weakDims.filter(([k]) => !RISK_DIMENSIONS.has(k)).sort((a, b) => a[1] - b[1])[0]
        || [...availableEntries].sort((a, b) => a[1] - b[1])[0]
        || ['N/A', 0];

    // Use confidenceTriad.decisionConfidence if available, else fall back to specialistMetadata average
    let confidence = 0;
    let confidenceLabel = 'Insufficient data';

    if (confidenceTriad) {
        confidence = confidenceTriad.decisionConfidence;
        confidenceLabel = `Decision: ${confidenceTriad.decisionConfidence}%`;

    } else if (specialistMetadata && specialistMetadata.length > 0) {
        const validScores = specialistMetadata
            .map(m => m.confidence_score)
            .filter((c): c is number => c !== null && c !== undefined && c > 0);
        if (validScores.length > 0) {
            confidence = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
            confidenceLabel = 'Specialist Consensus';
        }
    } else if (richDimensions) {
        // Fallback to richDimensions if specialistMetadata not yet available
        const richVals = Object.values(richDimensions);
        const validRich = richVals.map(r => (r as any).confidence_score).filter((c): c is number => c > 0);
        if (validRich.length > 0) {
            confidence = Math.round(validRich.reduce((a, b) => a + b, 0) / validRich.length);
            confidenceLabel = 'Specialist Consensus';
        }
    }

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
            label: 'Most Material Risk',
            value: keyRisk[0],
            subValue: `Exposure: ${keyRisk[1]}`,
            icon: AlertTriangle,
            color: 'text-rose-400',
            bg: 'bg-rose-500/10 border-rose-500/20'
        },
        {
            label: 'Analysis Confidence',
            value: confidence > 0 ? `${confidence}%` : 'Insufficient data',
            subValue: confidenceTriad
                ? `Evidence ${confidenceTriad.evidenceConfidence}% · Analytical ${confidenceTriad.analyticalConfidence}%`
                : confidenceLabel,
            icon: ShieldCheck,
            color: confidence > 0 ? getScoreColor(confidence) : 'text-zinc-500',
            bg: confidence > 0 ? getScoreBg(confidence) : 'bg-zinc-500/10 border-zinc-500/20'
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
                        <div className="p-2 rounded-lg bg-white/5">
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
