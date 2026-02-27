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
    // Transform Record<string, number> to Array for Recharts
    const radarData = Object.entries(dimensions).map(([key, value]) => ({
        subject: key,
        A: value,
        baseline: originalDimensions ? (originalDimensions[key] ?? value) : value,
        parity: 50, // Industry Parity "Ghost" Level
        fullMark: 100,
    }));

    const isStressMode = !!originalDimensions;

    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [1, 1.05, 1], opacity: 1 }}
            transition={{
                scale: {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                },
                opacity: { duration: 1 }
            }}
            style={{ width: '100%', height: '100%', minHeight: 400 }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#9ca3af', fontSize: 9, fontWeight: 500 }}
                        tickSize={12}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                    {/* Industry Parity (Ghost Layer) */}
                    <Radar
                        name="Industry Parity"
                        dataKey="parity"
                        stroke="#9ca3af"
                        fill="transparent"
                        strokeDasharray="4 4"
                        strokeOpacity={0.4}
                    />

                    {/* Baseline Radar (if in stress mode) */}
                    {isStressMode && (
                        <Radar
                            name="Baseline"
                            dataKey="baseline"
                            stroke="#4b5563"
                            fill="#4b5563"
                            fillOpacity={0.1}
                        />
                    )}

                    <Radar
                        name="Strategy"
                        dataKey="A"
                        stroke={isStressMode ? '#f97316' : '#a855f7'}
                        fill={isStressMode ? '#f97316' : '#a855f7'}
                        fillOpacity={0.5}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </motion.div>
    );
};
