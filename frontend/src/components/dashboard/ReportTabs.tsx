import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, BarChart3, GitBranch, FileText, Zap } from 'lucide-react';

export type TabId = 'overview' | 'matrix' | 'frameworks' | 'synthesis' | 'stress';

interface ReportTabsProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; description: string; icon: React.ElementType }[] = [
    { id: 'overview',    label: 'Overview',    description: 'Position & moat',    icon: LayoutDashboard },
    { id: 'matrix',      label: 'Scorecard',   description: '20 dimensions',      icon: BarChart3 },
    { id: 'frameworks',  label: 'Frameworks',  description: 'Porter · Ansoff · VRIO', icon: GitBranch },
    { id: 'synthesis',   label: 'Synthesis',   description: 'Strategy & roadmap', icon: FileText },
    { id: 'stress',      label: 'Stress Test', description: '5 crisis scenarios', icon: Zap },
];

export const ReportTabs: React.FC<ReportTabsProps> = ({ activeTab, onTabChange }) => {
    return (
        <div className="w-full max-w-7xl mx-auto mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-1">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <motion.button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            whileTap={{ scale: 0.97 }}
                            className={`relative flex flex-col items-start gap-1.5 px-4 py-3.5 rounded-xl border transition-all duration-200 outline-none text-left ${
                                isActive
                                    ? 'bg-violet-500/15 border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                                    : 'bg-white/[0.03] border-white/8 hover:bg-white/[0.06] hover:border-white/15'
                            }`}
                        >
                            <div className="flex items-center gap-2 w-full">
                                <Icon
                                    size={14}
                                    className={`flex-shrink-0 transition-colors duration-200 ${
                                        isActive ? 'text-violet-400' : 'text-zinc-500'
                                    }`}
                                />
                                <span className={`text-xs font-bold uppercase tracking-wider transition-colors duration-200 ${
                                    isActive ? 'text-white' : 'text-zinc-400'
                                }`}>
                                    {tab.label}
                                </span>
                                {isActive && (
                                    <motion.div
                                        layoutId="active-pill-dot"
                                        className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0"
                                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                    />
                                )}
                            </div>
                            <span className={`text-[10px] leading-tight transition-colors duration-200 ${
                                isActive ? 'text-violet-300/70' : 'text-zinc-600'
                            }`}>
                                {tab.description}
                            </span>
                            {isActive && (
                                <motion.div
                                    layoutId="active-pill-bg"
                                    className="absolute inset-0 rounded-xl bg-violet-500/5"
                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
