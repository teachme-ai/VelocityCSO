import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { AgentOrbs } from './AgentOrbs';
import { AgentStatus } from './AgentStatus';
import { StressTestPanel } from './StressTestPanel';
import type { StatusEvent } from './AgentStatus';
import type { StressResult } from '../types/stress';
import { DiagnosticScorecard } from './DiagnosticScorecard';
import { ShieldAlert, ChevronRight, X, Search, AlertTriangle, MessageSquare, Send } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/analyze';
const CLARIFY_URL = (import.meta.env.VITE_API_URL || '') + '/analyze/clarify';

type Phase =
    | 'idle'
    | 'discovery'
    | 'evaluating'
    | 'clarifying'
    | 'analyzing'
    | 'done'
    | 'error';

type ReportData = {
    analysis_markdown?: string;
    dimensions?: Record<string, number>;
    confidence_score?: number;
};

type ClarificationState = {
    sessionId: string;
    summary: string;
    gap: string;
    findings: string;
};

const LAST_REPORT_KEY = 'vcso_last_report_id';

function StarField() {
    return (
        <Canvas camera={{ position: [0, 0, 1] }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Stars radius={80} depth={60} count={6000} factor={4} saturation={0} fade speed={0.5} />
        </Canvas>
    );
}

/** Read SSE stream from a POST fetch response */
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
                try {
                    yield JSON.parse(line.slice(6));
                } catch { /* skip malformed */ }
            }
        }
    }
}

export function HeroSection() {
    const [context, setContext] = useState('');
    const [stressTest, setStressTest] = useState(false);
    const [phase, setPhase] = useState<Phase>('idle');
    const [phaseLabel, setPhaseLabel] = useState('');
    const [result, setResult] = useState<ReportData | null>(null);
    const [clarification, setClarification] = useState<ClarificationState | null>(null);
    const [clarificationInput, setClarificationInput] = useState('');
    const [error, setError] = useState('');
    const [sseEvents, setSseEvents] = useState<StatusEvent[]>([]);
    const [_lastReportId, setLastReportId] = useState<string | null>(null);
    const [stressResult, setStressResult] = useState<StressResult | null>(null);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Restore last report ID from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(LAST_REPORT_KEY);
        if (saved) setLastReportId(saved);
    }, []);

    const addEvent = (event: StatusEvent) =>
        setSseEvents(prev => [...prev, event]);

    // Maps ADK status to AgentOrbs status prop
    const agentStatus = phase === 'analyzing' ? 'cso'
        : phase === 'discovery' ? 'market'
            : phase === 'evaluating' ? 'finance'
                : 'idle';

    const handleAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!context.trim()) return;

        setResult(null); setError(''); setClarification(null);
        setSseEvents([]);
        setPhase('discovery');
        setPhaseLabel('Scanning 24 months of public signals...');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_context: context, stress_test: stressTest }),
            });

            for await (const event of readSSE(response)) {
                addEvent(event as StatusEvent);
                switch (event.type) {
                    case 'DISCOVERY_START':
                        setPhase('discovery');
                        setPhaseLabel('Running deep intelligence sweep...');
                        break;

                    case 'DISCOVERY_COMPLETE':
                        setPhase('evaluating');
                        setPhaseLabel((event.summary as string) || 'Evaluating completeness...');
                        break;

                    case 'NEED_CLARIFICATION':
                        setPhase('clarifying');
                        setClarification({
                            sessionId: event.sessionId as string,
                            summary: event.summary as string,
                            gap: event.gap as string,
                            findings: event.findings as string,
                        });
                        break;

                    case 'ANALYSIS_START':
                        setPhase('analyzing');
                        setPhaseLabel('Running 15-dimension diagnostic...');
                        break;

                    case 'REPORT_COMPLETE': {
                        const reportId = event.id as string;
                        const dims = event.dimensions as Record<string, number> | undefined;
                        let parsed: ReportData;
                        const raw = event.report as string;
                        try {
                            parsed = typeof raw === 'string'
                                ? JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim())
                                : raw as ReportData;
                        } catch {
                            parsed = { analysis_markdown: raw };
                        }
                        if (dims) parsed.dimensions = dims;
                        if (reportId) {
                            setLastReportId(reportId);
                            setCurrentReportId(reportId);
                            localStorage.setItem(LAST_REPORT_KEY, reportId);
                        }
                        setResult(parsed);
                        setStressResult(null);
                        setPhase('done');
                        break;
                    }

                    case 'ERROR':
                        setError((event.message as string) || 'An error occurred.');
                        setPhase('error');
                        break;
                }
            }
        } catch {
            setError('Connection failed. Please try again.');
            setPhase('error');
        }
    };

    const handleClarify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clarificationInput.trim() || !clarification) return;

        setPhase('analyzing');
        setPhaseLabel('Re-grounding context with your clarification...');
        setClarification(null);

        try {
            const response = await fetch(CLARIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: clarification.sessionId,
                    clarification: clarificationInput,
                    stress_test: stressTest,
                }),
            });

            for await (const event of readSSE(response)) {
                if (event.type === 'ANALYSIS_START') {
                    setPhaseLabel('Running 15-dimension diagnostic...');
                } else if (event.type === 'REPORT_COMPLETE') {
                    let parsed: ReportData;
                    const raw = event.report as string;
                    try {
                        parsed = typeof raw === 'string'
                            ? JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim())
                            : raw as ReportData;
                    } catch {
                        parsed = { analysis_markdown: raw };
                    }
                    setResult(parsed);
                    setPhase('done');
                } else if (event.type === 'ERROR') {
                    setError((event.message as string) || 'Clarification failed.');
                    setPhase('error');
                }
            }
        } catch {
            setError('Connection failed during clarification.');
            setPhase('error');
        }
    };

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
            {/* Deep Space Background */}
            <div className="absolute inset-0 z-0">
                <StarField />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 70% 80%, rgba(5,150,105,0.1) 0%, transparent 60%)' }} />
            </div>

            <div className="relative z-10 text-center w-full max-w-4xl mx-auto flex flex-col items-center gap-10">
                {/* Wordmark */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-sm font-medium tracking-[0.3em] uppercase text-violet-300" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Velocity CSO</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                </motion.div>

                {/* Headline */}
                <div className="space-y-2">
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="text-6xl md:text-8xl font-bold leading-[1.05] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        <span className="text-gradient-main">Strategy at the</span><br />
                        <span className="text-white">Speed of Thought.</span>
                    </motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}
                        className="text-lg text-gray-400 max-w-xl mx-auto mt-6 leading-relaxed">
                        A self-correcting AI strategy engine that discovers, interrogates, and diagnoses your business — before a single analysis runs.
                    </motion.p>
                </div>

                {/* Primary Input Pod */}
                <AnimatePresence mode="wait">
                    {phase === 'idle' || phase === 'error' ? (
                        <motion.div key="input"
                            initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="w-full max-w-2xl"
                        >
                            <form onSubmit={handleAudit} className="glass-card glow-purple p-6 flex flex-col gap-4">
                                <textarea
                                    ref={inputRef}
                                    className="w-full h-36 md:h-36 bg-transparent border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none text-base md:text-sm leading-relaxed"
                                    placeholder="Describe your business — model, market, constraints, ambition. Or just name a company. We'll discover the rest."
                                    value={context}
                                    onChange={(e) => setContext(e.target.value)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="sentences"
                                    spellCheck="true"
                                />
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-10 h-5 rounded-full flex items-center transition-all duration-300 px-0.5 ${stressTest ? 'bg-violet-600' : 'bg-white/10'}`}
                                            onClick={() => setStressTest(!stressTest)}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${stressTest ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                        <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">Conservative Stress Test</span>
                                    </label>
                                    <button type="submit" disabled={!context.trim()} className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                        Audit My Business <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                {error && <p className="text-red-400 text-xs">{error}</p>}
                            </form>
                        </motion.div>
                    ) : phase === 'clarifying' && clarification ? (
                        /* ── Chat Bubble: NEED_CLARIFICATION ── */
                        <motion.div key="clarify"
                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                            className="w-full max-w-2xl"
                        >
                            <div className="glass-card p-6 flex flex-col gap-5" style={{ borderColor: 'rgba(245,158,11,0.2)', boxShadow: '0 0 40px rgba(245,158,11,0.1)' }}>
                                {/* Discovery Summary */}
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 flex-shrink-0">
                                        <Search className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-1">Intelligence Found</p>
                                        <p className="text-sm text-gray-300 leading-relaxed">{clarification.summary}</p>
                                    </div>
                                </div>

                                {/* Gap Detected */}
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-amber-500/10 flex-shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Critical Gap Detected</p>
                                        <p className="text-sm text-amber-200/80 leading-relaxed">{clarification.gap}</p>
                                    </div>
                                </div>

                                {/* Clarification Prompt */}
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-violet-500/10 flex-shrink-0">
                                        <MessageSquare className="w-4 h-4 text-violet-400" />
                                    </div>
                                    <p className="text-sm text-violet-200 leading-relaxed pt-1">
                                        Can you help me fill in that gap? Your answer will be merged with the discovery data before the analysis runs.
                                    </p>
                                </div>

                                {/* Clarification Input */}
                                <form onSubmit={handleClarify} className="flex gap-3">
                                    <input
                                        type="text"
                                        className="flex-1 bg-transparent border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors text-base md:text-sm"
                                        placeholder="e.g. We pivoted from B2C to B2B in Q3 2024, targeting enterprise compliance teams..."
                                        value={clarificationInput}
                                        onChange={(e) => setClarificationInput(e.target.value)}
                                        autoFocus
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="sentences"
                                    />
                                    <button type="submit" disabled={!clarificationInput.trim()} className="btn-primary px-4 py-3 disabled:opacity-40 disabled:cursor-not-allowed">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    ) : (
                        /* ── Processing State ── */
                        <motion.div key="processing"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 w-full max-w-2xl"
                        >
                            <AgentOrbs status={agentStatus} />
                            <p className="text-sm text-gray-400 animate-pulse">{phaseLabel}</p>
                            <AgentStatus events={sseEvents} visible={sseEvents.length > 0} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Results Slide-Up Panel */}
            <AnimatePresence>
                {result && (
                    <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
                        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                        className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setResult(null); setPhase('idle'); }} />
                        <div className="relative glass-card w-full max-w-5xl flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-hidden rounded-t-2xl md:rounded-2xl">
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Strategy Intelligence Report</h2>
                                <button onClick={() => { setResult(null); setPhase('idle'); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-8">
                                {result.dimensions && Object.keys(result.dimensions).length > 0 && (
                                    <DiagnosticScorecard
                                        dimensions={stressResult ? stressResult.stressedScores : result.dimensions}
                                        originalDimensions={stressResult ? result.dimensions : undefined}
                                        onAreaClick={() => { }}
                                    />
                                )}
                                {/* Stress-Test Simulator Panel */}
                                {currentReportId && result.dimensions && Object.keys(result.dimensions).length > 0 && (
                                    <StressTestPanel
                                        reportId={currentReportId}
                                        originalScores={result.dimensions}
                                        onStressResult={(r) => setStressResult(r)}
                                        apiBase={import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/analyze', '') : ''}
                                    />
                                )}
                                {result.confidence_score && result.confidence_score < 70 && (
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-4">
                                        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-amber-300 font-semibold text-sm">Strategic Blindspot Detected</h4>
                                            <p className="text-amber-200/70 text-xs mt-1">Confidence: {result.confidence_score}/100. Critic flagged contradictions or insufficient supporting data.</p>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 tracking-wide uppercase">Executive Synthesis</h3>
                                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                                        {result.analysis_markdown || JSON.stringify(result, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
