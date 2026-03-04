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
    originalDimensions?: Record<string, number | null>;
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

function scoreColor(score: number): string {
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#2563eb';
    return '#dc2626';
}

interface DimTableProps {
    dimensions: Record<string, number | null>;
    originalDimensions?: Record<string, number | null>;
    showDelta: boolean;
    scenarioColor?: string;
}

function DimensionTable({ dimensions, originalDimensions, showDelta, scenarioColor }: DimTableProps) {
    const dimNames = Object.keys(dimensions);
    return (
        <div className="space-y-1.5 mt-3">
            {dimNames.map((dim) => {
                const score = dimensions[dim] ?? 0;
                const orig = originalDimensions?.[dim] ?? score;
                const delta = Math.round((score as number) - (orig as number));
                const color = scoreColor(score as number);
                const barW = Math.max(0, Math.min(100, score as number));

                return (
                    <div key={dim} className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 w-36 flex-shrink-0 truncate" title={dim}>{dim}</span>
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${barW}%`, background: color }}
                            />
                        </div>
                        <span className="text-[10px] font-bold w-7 text-right flex-shrink-0" style={{ color }}>{score}</span>
                        {showDelta && delta !== 0 && (
                            <span className={`text-[10px] font-bold w-8 flex-shrink-0 ${delta < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {delta > 0 ? `+${delta}` : delta}
                            </span>
                        )}
                        {showDelta && delta === 0 && (
                            <span className="text-[10px] text-zinc-600 w-8 flex-shrink-0">—</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function StressTestPanel({ reportId, onStressResult, apiBase, originalDimensions }: StressTestPanelProps) {
    const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
    const [loadingScenario, setLoadingScenario] = useState<ScenarioId | null>(null);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [mitigationCards, setMitigationCards] = useState<MitigationCard[]>([]);
    const [stressResult, setStressResult] = useState<StressResult | null>(null);
    const [dimTab, setDimTab] = useState<'original' | 'stressed'>('original');

    const handleToggle = async (scenarioId: ScenarioId) => {
        if (activeScenario === scenarioId) {
            setActiveScenario(null);
            setMitigationCards([]);
            setStressResult(null);
            setDimTab('original');
            onStressResult({ scenarioId, scenarioLabel: '', originalScores: {}, stressedScores: {}, riskDeltas: {}, mitigationCards: [] });
            return;
        }

        setLoadingScenario(scenarioId);
        setMitigationCards([]);
        setStressResult(null);

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
                    setStressResult(result);
                    setDimTab('stressed');
                    onStressResult(result);
                }
            }
        } catch (err) {
            console.error('Stress test failed:', err);
        } finally {
            setLoadingScenario(null);
        }
    };

    const activeMeta = activeScenario ? SCENARIO_META[activeScenario] : null;
    const dimsForOriginal = stressResult ? stressResult.originalScores : (originalDimensions as Record<string, number> | undefined);
    const dimsForStressed = stressResult?.stressedScores;

    return (
        <div className="w-full max-w-6xl space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8 items-start">
                {/* Left Column: Toggles */}
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Select Scenario</p>
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

                {/* Right Column: Results Feed */}
                <div className="min-h-[200px]">
                    <AnimatePresence mode="wait">
                        {mitigationCards.length > 0 ? (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                                            Risk Panel — {mitigationCards.length} Critical Shifts
                                        </p>
                                    </div>
                                </div>

                                {/* Internal Scrollable Area for Failure Feed */}
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
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
                                                        <p className="text-xs text-red-500 font-medium">
                                                            ↓ {Math.abs(card.riskDelta)}% Erosion
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
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden bg-black/20"
                                                    >
                                                        <div className="px-4 pb-4 pt-1 space-y-4">
                                                            <div>
                                                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Tactical Counter-Moves</p>
                                                                <ul className="space-y-2">
                                                                    {card.mitigationSteps.map((step, i) => (
                                                                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed">
                                                                            <span className="text-amber-500 flex-shrink-0 font-bold">0{i + 1}</span>
                                                                            {step}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>

                                                            {card.csoCrisisPlay && (
                                                                <div
                                                                    className="rounded-xl p-3 border-l-2 border-violet-500/50 bg-violet-500/5"
                                                                >
                                                                    <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest mb-1">CSO Strategic Directive</p>
                                                                    <p className="text-xs text-zinc-300 leading-relaxed italic">"{card.csoCrisisPlay}"</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10"
                            >
                                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                                    <Zap className="w-6 h-6 text-zinc-600" />
                                </div>
                                <p className="text-xs text-zinc-500 font-medium">No stress scenario active.</p>
                                <p className="text-[10px] text-zinc-700 mt-1 max-w-[180px]">Select a catalyst from the left panel to begin recalculation.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Dimension View — expands when a stress result is available */}
            <AnimatePresence>
                {stressResult && dimsForOriginal && dimsForStressed && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl overflow-hidden"
                    >
                        {/* Sub-tab header */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-0">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Dimension Impact</p>
                            <div className="flex items-center gap-1 bg-zinc-800/60 rounded-lg p-0.5">
                                <button
                                    onClick={() => setDimTab('original')}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${dimTab === 'original' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    Original
                                </button>
                                <button
                                    onClick={() => setDimTab('stressed')}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${dimTab === 'stressed' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    style={dimTab === 'stressed' ? { background: activeMeta ? `${activeMeta.color}30` : undefined, color: activeMeta?.color } : {}}
                                >
                                    Stressed
                                </button>
                            </div>
                        </div>

                        <div className="px-5 pb-5">
                            <AnimatePresence mode="wait">
                                {dimTab === 'original' ? (
                                    <motion.div key="orig" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <DimensionTable
                                            dimensions={dimsForOriginal}
                                            showDelta={false}
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div key="stress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                        <div className="flex items-center gap-2 mt-3 mb-1">
                                            {activeMeta && (
                                                <>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: activeMeta.color }}>
                                                        {activeMeta.label}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-600">— delta vs baseline</span>
                                                </>
                                            )}
                                        </div>
                                        <DimensionTable
                                            dimensions={dimsForStressed}
                                            originalDimensions={dimsForOriginal}
                                            showDelta={true}
                                            scenarioColor={activeMeta?.color}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
