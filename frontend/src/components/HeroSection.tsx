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

import ReactMarkdown from 'react-markdown';

// ─── Strategic UI Components ────────────────────────────────────────────────
const AsymmetricCard = ({ children }: { children: React.ReactNode }) => (
    <div className="relative group overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-6 my-6 transition-all duration-500 hover:bg-white/[0.07] hover:border-violet-500/30">
        <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
            <ShieldAlert className="w-8 h-8 text-violet-400" />
        </div>
        <div className="relative z-10 text-gray-200">
            {children}
        </div>
    </div>
);

const SavvyRecommendation = ({ children }: { children: React.ReactNode }) => (
    <div className="border-l-4 border-blue-600 pl-6 my-6 italic bg-blue-600/5 py-4 rounded-r-xl text-blue-100/90 shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]">
        {children}
    </div>
);

/**
 * Regex Stripper: Add a utility to strip all json, markdown, and backtick tags 
 * from the analysis_markdown string before rendering.
 */
function sanitizeReport(text: string): string {
    return text
        .replace(/```json[\s\S]*?```/g, '') // Remove json code blocks
        .replace(/\{[\s\S]*?\}/g, '')       // Remove raw JSON objects
        .replace(/```markdown/g, '')        // Remove markdown tags
        .replace(/```/g, '')                // Remove any remaining backticks
        .replace(/^## Dimension Scores[\s\S]*$/im, '') // Remove dimension scores table (already in sidebar)
        .trim();
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
    const [currentReportToken, setCurrentReportToken] = useState<string | null>(null);
    const [showScorecard, setShowScorecard] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (stressResult) {
            console.log('[UI] Stress test result received — showing scorecard with stressed dimensions', { scenario: stressResult.scenarioId, stressedScores: stressResult.stressedScores });
            setShowScorecard(true);
        }
    }, [stressResult]);

    // Restore last report ID from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(LAST_REPORT_KEY);
        if (saved) setLastReportId(saved);
    }, []);

    const addEvent = (event: StatusEvent) =>
        setSseEvents(prev => [...prev, event]);

    // Maps ADK status to AgentOrbs status prop
    const agentStatus = phase === 'analyzing' ? 'cso'
        : phase === 'discovery' ? 'interrogator'
            : phase === 'evaluating' ? 'market'
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
                    case 'INTERROGATOR_START':
                        setPhase('discovery');
                        setPhaseLabel('Analyzing business context...');
                        break;

                    case 'INTERROGATOR_RESPONSE':
                        setPhase('evaluating');
                        setPhaseLabel(`${event.category} · ID Score: ${event.idScore}/100`);
                        break;

                    case 'READY_FOR_AUDIT':
                        setPhase('analyzing');
                        setPhaseLabel(`ID Score ${event.idScore}/100 — Unlocking specialist analysis...`);
                        break;

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
                            idScore: event.idScore as number,
                            idBreakdown: event.idBreakdown as any,
                            usedLenses: event.usedLenses as string[] || [],
                        });
                        break;

                    case 'ANALYSIS_START':
                        setPhase('analyzing');
                        setPhaseLabel('Running 15-dimension diagnostic...');
                        break;

                    case 'REPORT_COMPLETE': {
                        const reportId = event.id as string;
                        const dims = event.dimensions as Record<string, number> | undefined;
                        const raw = event.report as string;
                        const parsed: ReportData = {
                            analysis_markdown: raw,
                            dimensions: dims || {},
                        };
                        if (reportId) {
                            setLastReportId(reportId);
                            setCurrentReportId(reportId);
                            setCurrentReportToken((event.token as string) || reportId.slice(-8));
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
                if (event.type === 'INTERROGATOR_RESPONSE') {
                    setPhaseLabel(`${event.category} · ID Score: ${event.idScore}/100`);
                } else if (event.type === 'NEED_CLARIFICATION') {
                    setPhase('clarifying');
                    setClarification({
                        sessionId: event.sessionId as string,
                        summary: event.summary as string,
                        gap: event.gap as string,
                        findings: event.findings as string,
                        idScore: event.idScore as number,
                        idBreakdown: event.idBreakdown as any,
                        usedLenses: event.usedLenses as string[] || [],
                    });
                } else if (event.type === 'READY_FOR_AUDIT') {
                    setPhaseLabel(`ID Score ${event.idScore}/100 — Unlocking specialist analysis...`);
                } else if (event.type === 'ANALYSIS_START') {
                    setPhaseLabel('Running 15-dimension diagnostic...');
                } else if (event.type === 'REPORT_COMPLETE') {
                    const raw = event.report as string;
                    const dims = event.dimensions as Record<string, number> | undefined;
                    const reportId = event.id as string;
                    setResult({ analysis_markdown: raw, dimensions: dims || {} });
                    if (reportId) {
                        setCurrentReportId(reportId);
                        setCurrentReportToken((event.token as string) || reportId.slice(-8));
                    }
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
                            <div className="glass-card p-6 flex flex-col gap-5" style={{
                                borderColor: 'rgba(245,158,11,0.2)',
                                boxShadow: clarification.idScore && clarification.idScore >= 50
                                    ? `0 0 ${clarification.idScore * 0.6}px rgba(37,99,235,0.3)`
                                    : '0 0 40px rgba(245,158,11,0.1)'
                            }}>
                                {/* Lens Progress */}
                                <div className="flex items-center gap-3">
                                    {[
                                        { id: 'CUSTOMER/MARKET', label: 'Market', icon: '👥' },
                                        { id: 'COMPETITOR/MOAT', label: 'Moat', icon: '🛡️' },
                                        { id: 'OPERATIONS/SUPPLY', label: 'Ops', icon: '⚙️' },
                                    ].map(lens => {
                                        const done = clarification.usedLenses?.includes(lens.id);
                                        return (
                                            <div key={lens.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-500 ${done ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-500 border border-white/10'
                                                }`}>
                                                <span>{lens.icon}</span>
                                                <span>{lens.label}</span>
                                                {done && <span>✓</span>}
                                            </div>
                                        );
                                    })}
                                    <span className="ml-auto text-xs text-gray-500">ID: <span className="text-white font-bold">{clarification.idScore || 0}</span>/100</span>
                                </div>
                                {/* Discovery Summary */}
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-violet-500/10 flex-shrink-0">
                                        <Search className="w-4 h-4 text-violet-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-1">Strategic Context</p>
                                        <p className="text-sm text-gray-300 leading-relaxed">{clarification.summary}</p>
                                        {clarification.findings && (
                                            <div className="mt-2 p-2 bg-white/5 rounded text-xs text-gray-400">
                                                {clarification.findings}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Gap Detected */}
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-amber-500/10 flex-shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Deepening Question</p>
                                        <p className="text-sm text-amber-200/80 leading-relaxed">{clarification.gap}</p>
                                        {/* ID Score Breakdown */}
                                        {clarification.idBreakdown && (
                                            <div className="mt-3 flex flex-col gap-1.5">
                                                {[
                                                    { label: 'Specificity', value: clarification.idBreakdown.specificity, color: 'bg-violet-500' },
                                                    { label: 'Completeness', value: clarification.idBreakdown.completeness, color: 'bg-emerald-500' },
                                                    { label: 'Moat Potential', value: clarification.idBreakdown.moat, color: 'bg-amber-500' },
                                                ].map(({ label, value, color }) => (
                                                    <div key={label} className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
                                                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${value}%` }}
                                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                className={`h-full ${color}`}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
                                                    </div>
                                                ))}
                                                <p className="text-xs text-gray-500 mt-1">ID Score: <span className="text-white font-semibold">{clarification.idScore}/100</span> — need 70 to unlock analysis</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Clarification Prompt */}
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-violet-500/10 flex-shrink-0">
                                        <MessageSquare className="w-4 h-4 text-violet-400" />
                                    </div>
                                    <p className="text-sm text-violet-200 leading-relaxed pt-1">
                                        Help me understand this better:
                                    </p>
                                </div>

                                {/* Clarification Input with Signal Strength */}
                                <form onSubmit={handleClarify} className="flex flex-col gap-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors text-base md:text-sm"
                                            placeholder="Type your answer..."
                                            value={clarificationInput}
                                            onChange={(e) => setClarificationInput(e.target.value)}
                                            autoFocus
                                            autoComplete="off"
                                            autoCorrect="off"
                                            autoCapitalize="sentences"
                                        />
                                        {/* Signal Strength Meter */}
                                        {clarificationInput.length > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, clarificationInput.length / 2)}%` }}
                                                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-violet-500 to-emerald-500"
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">
                                            Signal: {Math.min(100, Math.floor(clarificationInput.length / 2))}%
                                        </span>
                                        <button type="submit" disabled={!clarificationInput.trim()} className="btn-primary px-4 py-3 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                            <Send className="w-4 h-4" /> Continue
                                        </button>
                                    </div>
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
                            <p className="text-sm text-gray-400 animate-pulse">
                                {phaseLabel === 'Re-grounding context with your clarification...'
                                    ? 'Context depth reached. Converging specialists for the final audit...'
                                    : phaseLabel}
                            </p>
                            <AgentStatus events={sseEvents} visible={sseEvents.length > 0} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Full-Screen Report Page */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', stiffness: 100, damping: 22 }}
                        style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#0a0a0f' }}
                    >
                        {/* Top Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} />
                                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>Strategy Intelligence Report</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {currentReportId && currentReportToken && (
                                    <a href={`/report/${currentReportId}/download?token=${currentReportToken}`} target="_blank" rel="noopener noreferrer"
                                        style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.4)', color: '#93C5FD', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        ↓ Board-Ready PDF
                                    </a>
                                )}
                                <button onClick={() => { setResult(null); setPhase('idle'); }}
                                    style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Body: Left Sidebar + Right Report */}
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                            {/* LEFT SIDEBAR — Scorecard (hidden until stress test) + Stress Test */}
                            <div style={{ width: showScorecard ? 320 : 140, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 20, transition: 'width 0.3s ease' }}>
                                {showScorecard && (
                                    <>
                                        <DiagnosticScorecard
                                            dimensions={stressResult ? stressResult.stressedScores : (result.dimensions || {})}
                                            originalDimensions={stressResult ? result.dimensions : undefined}
                                            onAreaClick={() => { }}
                                        />
                                        <div style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>Stress Test Results</div>
                                    </>
                                )}
                                {currentReportId && (
                                    <StressTestPanel
                                        reportId={currentReportId}
                                        originalScores={result.dimensions || {}}
                                        onStressResult={(r) => {
                                            console.log('[UI] Stress test clicked \u2014 expanding scorecard', { scenario: r.scenarioId });
                                            setStressResult(r);
                                        }}
                                        apiBase={import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/analyze', '') : ''}
                                    />
                                )}
                            </div>

                            {/* RIGHT PANEL — Full Report */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                                {result.confidence_score && result.confidence_score < 70 && (
                                    <div style={{ padding: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, display: 'flex', gap: 12, marginBottom: 24 }}>
                                        <ShieldAlert size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                                        <div>
                                            <p style={{ color: '#fcd34d', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Strategic Blindspot Detected</p>
                                            <p style={{ color: 'rgba(252,211,77,0.7)', fontSize: 12 }}>Confidence: {result.confidence_score}/100. Critic flagged contradictions or insufficient supporting data.</p>
                                        </div>
                                    </div>
                                )}
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#34d399', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>Executive Synthesis</p>
                                <div className="report-content text-sm text-gray-300 leading-relaxed">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ children }) => <h1 className="text-3xl font-bold text-white mb-6 mt-10">{children}</h1>,
                                            h2: ({ children }) => <h2 className="text-xl font-bold text-violet-300 mb-4 mt-8 uppercase tracking-wider">{children}</h2>,
                                            h3: ({ children }) => {
                                                const text = String(children);
                                                if (text.toLowerCase().includes('asymmetric play')) {
                                                    return (
                                                        <div className="flex items-center gap-2 mb-2 mt-6">
                                                            <div className="w-1.5 h-6 bg-violet-500 rounded-full" />
                                                            <h3 className="text-lg font-bold text-white">{children}</h3>
                                                        </div>
                                                    );
                                                }
                                                return <h3 className="text-lg font-bold text-white mb-3 mt-6">{children}</h3>;
                                            },
                                            p: ({ children }) => {
                                                const text = String(children);
                                                if (text.toLowerCase().includes('asymmetric play')) {
                                                    return <AsymmetricCard>{children}</AsymmetricCard>;
                                                }
                                                if (text.startsWith('Because ') && (text.includes(' cannot ') || text.includes(' can\'t '))) {
                                                    return <SavvyRecommendation>{children}</SavvyRecommendation>;
                                                }
                                                return <p className="mb-4 leading-relaxed">{children}</p>;
                                            },
                                            li: ({ children }) => (
                                                <li className="flex gap-3 my-2 items-start">
                                                    <span className="text-violet-500 mt-1.5 flex-shrink-0">•</span>
                                                    <span>{children}</span>
                                                </li>
                                            ),
                                            ul: ({ children }) => <ul className="my-4">{children}</ul>,
                                        }}
                                    >
                                        {sanitizeReport(result.analysis_markdown || '')}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
