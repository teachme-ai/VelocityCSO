import React from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';

interface StrategyRadarProps {
    dimensions: Record<string, number>;
    originalDimensions?: Record<string, number>;
}

export const StrategyRadar: React.FC<StrategyRadarProps> = ({ dimensions, originalDimensions }) => {
    const ABBREVIATIONS: Record<string, string> = {
        'TAM Viability': 'TAM',
        'Target Precision': 'Target',
        'Trend Adoption': 'Trend',
        'Team / Founder Strength': 'Team',
        'Competitive Defensibility': 'Moat',
        'Model Innovation': 'Innov',
        'Flywheel Potential': 'Fly',
        'Network Effects Strength': 'Netw',
        'Data Asset Quality': 'Data',
        'Pricing Power': 'Price',
        'CAC/LTV Ratio': 'CAC',
        'Market Entry Speed': 'Entry',
        'Execution Speed': 'Exec',
        'Scalability': 'Scale',
        'ESG Posture': 'ESG',
        'Regulatory Readiness': 'Reg',
        'ROI Projection': 'ROI',
        'Risk Tolerance': 'Risk',
        'Capital Efficiency': 'Cap',
        'Customer Concentration Risk': 'Conc'
    };

    // Transform Record<string, number> to Array for Recharts
    const radarData = Object.entries(dimensions).map(([key, value]) => ({
        subject: ABBREVIATIONS[key] || key.slice(0, 5),
        A: value,
        baseline: originalDimensions ? (originalDimensions[key] ?? value) : value,
        parity: 50, // Industry Parity "Ghost" Level
        fullMark: 100,
    }));

    const isStressMode = !!originalDimensions;

    const avgScore = Math.round(Object.values(dimensions).reduce((a, b) => a + b, 0) / Object.values(dimensions).length);

    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            style={{
                width: '100%',
                height: '100%',
                minHeight: 280,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <div style={{
                position: 'absolute',
                textAlign: 'center',
                zIndex: 10,
                pointerEvents: 'none',
                fontFamily: 'Space Grotesk, sans-serif'
            }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Asymmetric Advantage
                </div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>
                    {avgScore}<span style={{ fontSize: '14px', opacity: 0.5 }}>/100</span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="42%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Inter, sans-serif' }}
                        axisLine={false}
                    />
                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                    />

                    {/* Industry Parity (Ghost Layer) - Thinner */}
                    <Radar
                        name="Industry Parity"
                        dataKey="parity"
                        stroke="#9ca3af"
                        fill="transparent"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                        strokeOpacity={0.2}
                    />

                    {/* Baseline Radar (if in stress mode) */}
                    {isStressMode && (
                        <Radar
                            name="Baseline"
                            dataKey="baseline"
                            stroke="#4b5563"
                            fill="#4b5563"
                            fillOpacity={0.05}
                        />
                    )}

                    <Radar
                        name="Strategy"
                        dataKey="A"
                        stroke={isStressMode ? '#f97316' : '#a855f7'}
                        fill={isStressMode ? '#f97316' : '#a855f7'}
                        fillOpacity={0.6}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </motion.div>
    );
};
