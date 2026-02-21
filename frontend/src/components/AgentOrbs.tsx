
import React from 'react';
import { motion } from 'framer-motion';

export const AgentOrbs = ({ status }: { status: 'idle' | 'market' | 'finance' | 'cso' }) => {
    const orbs = [
        { id: 'market', color: 'bg-savvy-purple', hex: '#A855F7', label: 'Market Analyst Sensing' },
        { id: 'finance', color: 'bg-savvy-gold', hex: '#F59E0B', label: 'Financial Analyst Calculating Risk' },
        { id: 'cso', color: 'bg-savvy-green', hex: '#10B981', label: 'CSO Synthesizing Strategy' },
    ];

    return (
        <div className="flex justify-center items-center gap-8 py-8">
            {orbs.map((orb) => {
                const isActive = status === orb.id;
                return (
                    <div key={orb.id} className="flex flex-col items-center gap-3">
                        <motion.div
                            className={`w-12 h-12 rounded-full ${orb.color} shadow-lg`}
                            animate={{
                                scale: isActive ? [1, 1.2, 1] : 1,
                                opacity: isActive ? [0.6, 1, 0.6] : 0.3,
                                boxShadow: isActive ? `0 0 20px var(--tw-shadow-color)` : 'none',
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: isActive ? Infinity : 0,
                                ease: "easeInOut"
                            }}
                            style={{
                                '--tw-shadow-color': orb.hex
                            } as React.CSSProperties}
                        />
                        <span className={`text-xs font-medium transition-opacity duration-300 ${isActive ? 'opacity-100 text-white' : 'opacity-40 text-gray-400'}`}>
                            {orb.label}
                        </span>
                    </div>
                );
            })}
        </div >
    );
};
