import React from 'react';
import { motion } from 'framer-motion';

export type TabId = 'overview' | 'matrix' | 'frameworks' | 'synthesis' | 'stress';

interface ReportTabsProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'matrix', label: 'Dimension Matrix' },
    { id: 'frameworks', label: 'Strategic Frameworks' },
    { id: 'synthesis', label: 'Executive Synthesis' },
    { id: 'stress', label: 'Stress Simulator' },
];

export const ReportTabs: React.FC<ReportTabsProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="w-full max-w-7xl mx-auto flex items-center gap-2 px-2 mb-8 border-b border-white/5">
            {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className="relative px-6 py-4 text-xs font-bold uppercase tracking-widest transition-colors outline-none"
                    >
                        <span className={`relative z-10 transition-colors duration-300 ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            {tab.label}
                        </span>
                        {isActive && (
                            <motion.div
                                layoutId="active-tab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                        )}
                        {isActive && (
                            <motion.div
                                layoutId="active-tab-glow"
                                className="absolute bottom-0 left-0 right-0 h-4 bg-violet-500/10 blur-lg"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
