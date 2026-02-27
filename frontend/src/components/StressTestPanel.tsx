/**
 * StressTestPanel — What-If Scenario Simulator
 *
 * Glassmorphism scenario toggles that send stress-test recalculation requests
 * to POST /analyze/stress-test and animate the Radar Chart with a ghost-layer.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, Swords, Rocket, Users, Shield, ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';
import type { MitigationCard } from '../types/stress';

const SCENARIO_META = {
    RECESSION: { label: 'Economic Recession', icon: TrendingDown, color: '#ef4444', glow: 'rgba(239,68,68,0.15)' },
    PRICE_WAR: { label: 'Competitor Price War', icon: Swords, color: '#f97316', glow: 'rgba(249,115,22,0.15)' },
    SCALE_UP: { label: 'Aggressive Scale-Up', icon: Rocket, color: '#8b5cf6', glow: 'rgba(139,92,246,0.15)' },
    TALENT: { label: 'Global Talent Shortage', icon: Users, color: '#06b6d4', glow: 'rgba(6,182,212,0.15)' },
    REGULATORY: { label: 'Regulatory Crackdown', icon: Shield, color: '#eab308', glow: 'rgba(234,179,8,0.15)' },
} as const;

type ScenarioId = keyof typeof SCENARIO_META;

interface StressTestPanelProps {
    reportId: string;
    onStressResult: (result: StressResult) => void;
    apiBase: string;
}

interface StressResult {
    scenarioId: ScenarioId;
    scenarioLabel: string;
    originalScores: Record<string, number>;
    stressedScores: Record<string, number>;
    riskDeltas: Record<string, number>;
    mitigationCards: MitigationCard[];
}

async function* readSSE(response: Response): AsyncGenerator<Record<string, unknown>> {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try { yield JSON.parse(line.slice(6)); } catch { /* skip */ }
            }
        }
    }
}

export function StressTestPanel({ reportId, onStressResult, apiBase }: StressTestPanelProps) {
    const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
    const [loadingScenario, setLoadingScenario] = useState<ScenarioId | null>(null);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [mitigationCards, setMitigationCards] = useState<MitigationCard[]>([]);

    const handleToggle = async (scenarioId: ScenarioId) => {
        // Toggle off if already active
        if (activeScenario === scenarioId) {
            setActiveScenario(null);
            setMitigationCards([]);
            return;
        }

        setLoadingScenario(scenarioId);
        setMitigationCards([]);

        try {
            const response = await fetch(`${apiBase}/analyze/stress-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId, scenarioId }),
            });

            for await (const event of readSSE(response)) {
                if (event.type === 'STRESS_COMPLETE') {
                    const result = event as unknown as StressResult;
                    setActiveScenario(scenarioId);
                    setMitigationCards(result.mitigationCards || []);
                    onStressResult(result);
                }
            }
        } catch (err) {
            console.error('Stress test failed:', err);
        } finally {
            setLoadingScenario(null);
        }
    };

    return (
        <div className="w-full max-w-4xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/10">
                    <Zap className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white">Stress-Test Simulator</h3>
                    <p className="text-xs text-gray-400">Simulate crisis scenarios — AI recalculates your 15 dimensions instantly</p>
                </div>
            </div>

            {/* Scenario Toggles - Vertical Stack */}
            <div className="flex flex-col gap-2">
                {(Object.entries(SCENARIO_META) as [ScenarioId, typeof SCENARIO_META[ScenarioId]][]).map(([id, meta]) => {
                    const Icon = meta.icon;
                    const isActive = activeScenario === id;
                    const isLoading = loadingScenario === id;

                    return (
                        <motion.button
                            key={id}
                            onClick={() => handleToggle(id)}
                            disabled={loadingScenario !== null}
                            whileHover={{ scale: 1.01, x: 4 }}
                            whileTap={{ scale: 0.99 }}
                            className="relative p-3 rounded-xl border text-left transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
                            style={{
                                background: isActive ? `${meta.glow}` : 'rgba(255,255,255,0.03)',
                                borderColor: isActive ? `${meta.color}50` : 'rgba(255,255,255,0.06)',
                                boxShadow: isActive ? `0 0 16px ${meta.glow}` : 'none',
                            }}
                        >
                            {isLoading && (
                                <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-lg flex-shrink-0 transition-colors group-hover:bg-opacity-30" style={{ background: `${meta.color}20` }}>
                                    <Icon className="w-4 h-4" style={{ color: meta.color }} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-white tracking-wide">{meta.label}</p>
                                    {isActive ? (
                                        <p className="text-[10px] h-3 animate-pulse" style={{ color: meta.color }}>Active Simulation</p>
                                    ) : (
                                        <p className="text-[10px] text-gray-500 h-3">Tap to simulate</p>
                                    )}
                                </div>
                                {isActive && (
                                    <Zap className="w-3 h-3 text-white fill-white" />
                                )}
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Mitigation Cards */}
            <AnimatePresence>
                {mitigationCards.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                    >
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                                Failing Dimensions — Mitigation Playbook
                            </p>
                        </div>

                        {mitigationCards.map((card) => (
                            <motion.div
                                key={card.dimension}
                                layout
                                className="rounded-2xl border overflow-hidden"
                                style={{
                                    borderColor: 'rgba(245,158,11,0.2)',
                                    background: 'rgba(245,158,11,0.04)',
                                }}
                            >
                                {/* Card Header */}
                                <button
                                    className="w-full flex items-center justify-between p-4 text-left"
                                    onClick={() => setExpandedCard(expandedCard === card.dimension ? null : card.dimension)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                                            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                                        >
                                            {card.stressedScore}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-white">{card.dimension}</p>
                                            <p className="text-xs text-red-400">
                                                ↓ {Math.abs(card.riskDelta)} points from baseline
                                            </p>
                                        </div>
                                    </div>
                                    {expandedCard === card.dimension
                                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                                    }
                                </button>

                                {/* Expanded Content */}
                                <AnimatePresence>
                                    {expandedCard === card.dimension && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: 'auto' }}
                                            exit={{ height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 space-y-4">
                                                {/* Mitigation Steps */}
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Actions</p>
                                                    <ul className="space-y-1.5">
                                                        {card.mitigationSteps.map((step, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                                                <span className="text-amber-400 flex-shrink-0 font-semibold">{i + 1}.</span>
                                                                {step}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* CSO Crisis Play */}
                                                {card.csoCrisisPlay && (
                                                    <div
                                                        className="rounded-xl p-3"
                                                        style={{ background: 'rgba(139,92,246,0.08)', borderLeft: '3px solid rgba(139,92,246,0.4)' }}
                                                    >
                                                        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide mb-1">CSO Crisis Play</p>
                                                        <p className="text-xs text-gray-300 leading-relaxed">{card.csoCrisisPlay}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
