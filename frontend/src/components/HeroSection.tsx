import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
    UnitEconomicsData,
    FiveForcesData,
    WardleyResult,
    BlueOceanResult,
    AnsoffMatrixData,
    VrioAnalysisData
} from '../types/frameworks';
import { AgentOrbs } from './AgentOrbs';
import { StressTestPanel } from './StressTestPanel';
import type { StatusEvent } from './AgentStatus';
import type { StressResult } from '../types/stress';
import { DiagnosticScorecard, type RichDimensionData } from './DiagnosticScorecard';
import { ShieldAlert, ChevronRight, X, Search, AlertTriangle, MessageSquare, Send, Globe, Paperclip } from 'lucide-react';
import { StrategyRadar } from './StrategyRadar';
import { AgentHeartbeat } from './AgentHeartbeat';
import { type HeartbeatLog } from './HeartbeatTerminal';
import { ExecutiveSummaryCard } from './ExecutiveSummaryCard';
import { BlueOceanCanvas } from './BlueOceanCanvas';
import { UnitEconomicsDashboard } from './UnitEconomicsDashboard';
import { FiveForces } from './FiveForces';
import { WardleyMap } from './WardleyMap';
import { MonteCarloChart } from './MonteCarloChart';
import { AnsoffMatrix } from './AnsoffMatrix';
import { VrioCard } from './VrioCard';
import { KpiRow } from './dashboard/KpiRow';
import { CategorySummary } from './dashboard/CategorySummary';
import { ReportTabs } from './dashboard/ReportTabs';
import type { TabId } from './dashboard/ReportTabs';

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

type MonteCarloData = {
    distributions: any[];
    risk_drivers: any[];
};

type ReportData = {
    analysis_markdown?: string;
    dimensions?: Record<string, number | null>;
    confidence_score?: number;
    orgName?: string;
    moatRationale?: string;
    richDimensions?: Record<string, RichDimensionData>;
    frameworks?: {
        unit_economics?: UnitEconomicsData;
        five_forces?: FiveForcesData;
        wardley?: WardleyResult;
        blue_ocean?: BlueOceanResult;
        monte_carlo?: MonteCarloData;
        ansoffMatrix?: AnsoffMatrixData;
        vrioAnalysis?: VrioAnalysisData;
    };
};

type ClarificationState = {
    sessionId: string;
    summary: string;
    gap: string;
    findings: string;
    idScore?: number;
    idBreakdown?: { specificity: number; completeness: number; moat: number };
    usedLenses?: string[];
};

const LAST_REPORT_KEY = 'vcso_last_report_id';

function StarField() {
    return (
        <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 to-black" />
        </div>
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
        .replace(/#{1,4}\s*Dimension Scores[\s\S]*$/im, '') // any heading level
        .replace(/Dimension Scores:?[\s\S]*$/im, '')
        .trim();
}

const PlaceholderCard = ({ title, description, icon: Icon }: { title: string, description: string, icon: React.ComponentType<any> }) => (
    <div className="bg-zinc-900/30 border border-zinc-800/50 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center opacity-60 h-full min-h-[300px]">
        <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
            <Icon className="w-6 h-6 text-zinc-500" />
        </div>
        <h4 className="text-zinc-400 font-bold mb-2">{title}</h4>
        <p className="text-zinc-500 text-sm max-w-xs">{description}</p>
    </div>
);

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
    const [stressResult, setStressResult] = useState<StressResult | null>(null);
    const [currentReportId, setCurrentReportId] = useState<string | null>(null);
    const [currentReportToken, setCurrentReportToken] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [heartbeatLogs, setHeartbeatLogs] = useState<HeartbeatLog[]>([]);
    const [companyUrl, setCompanyUrl] = useState('');
    const [urlEnriching, setUrlEnriching] = useState(false);
    const [urlEnriched, setUrlEnriched] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState('');
    const [auditTimestamp, setAuditTimestamp] = useState<string>('');
    const [briefExpanded, setBriefExpanded] = useState(false);
    const [orgSector, setOrgSector] = useState<string>('');
    const [orgScale, setOrgScale] = useState<string>('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const enrichFromUrl = async () => {
        if (!companyUrl) return;

        let urlTarget = companyUrl.trim();
        if (!/^https?:\/\//i.test(urlTarget)) {
            urlTarget = `https://${urlTarget}`;
        }

        setUrlEnriching(true);
        setUrlEnriched(false);
        setError('');

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/enrich/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlTarget }),
            });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Enrichment failed');

            const data = result.data;
            const enrichedText = `
WEBSITE CONTEXT (scraped from ${urlTarget}):
Title: ${data.title}
Description: ${data.description}
Products: ${data.product_pages?.join(', ')}
Pricing: ${data.pricing_signals?.join(', ')}
Tech: ${data.technology_signals?.join(', ')}

${context}`.trim();

            setContext(enrichedText);
            setUrlEnriched(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUrlEnriching(false);
        }
    };

    const handleFileUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('document', file);

        setPhaseLabel(`Parsing ${file.name}...`);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/enrich/document`, {
                method: 'POST',
                // Note: Don't set Content-Type header when using FormData; the browser will set it with the boundary
                body: formData,
            });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Upload failed');

            const data = result.data;
            const enrichedText = `
DOCUMENT: ${data.filename}
${data.text}

${context}`.trim();

            setContext(enrichedText);
            setPhaseLabel('Context enriched from document.');
            setTimeout(() => setPhaseLabel(''), 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };


    const addEvent = (event: StatusEvent) =>
        setSseEvents(prev => [...prev, event]);

    const handleStressResult = (result: StressResult) => {
        setStressResult(result);
        setActiveTab('matrix');
    };

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
        setHeartbeatLogs([]); // Reset logs for new audit
        setPhase('discovery');
        setPhaseLabel('Scanning 24 months of public signals...');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_context: [
                        context,
                        orgSector ? `[SECTOR: ${orgSector}]` : '',
                        orgScale ? `[ORG SCALE: ${orgScale}]` : '',
                    ].filter(Boolean).join(' '),
                    stress_test: stressTest
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with ${response.status}`);
            }

            for await (const event of readSSE(response)) {
                addEvent(event as StatusEvent);

                if (event.type === 'SESSION_INIT' && event.sessionId) {
                    // setCurrentSessionId(event.sessionId); // Assuming setCurrentSessionId is defined elsewhere if needed
                    setHeartbeatLogs([]); // Reset for new session
                }
                if (event.type === 'HEARTBEAT_LOG' && event.log) {
                    setHeartbeatLogs(prev => [...prev, event.log as HeartbeatLog]);
                }

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
                            idBreakdown: event.idBreakdown as { specificity: number; completeness: number; moat: number },
                            usedLenses: event.usedLenses as string[] || [],
                        });
                        break;

                    case 'ANALYSIS_START':
                        setPhase('analyzing');
                        setPhaseLabel('Running 20-dimension diagnostic...');
                        break;

                    case 'REPORT_COMPLETE': {
                        const reportId = event.id as string;
                        const dims = event.dimensions as Record<string, number | null> | undefined;
                        const raw = event.report as string;
                        const parsed: ReportData = {
                            analysis_markdown: raw,
                            dimensions: dims || {},
                            orgName: event.orgName as string,
                            moatRationale: event.moatRationale as string,
                            richDimensions: event.richDimensions as Record<string, RichDimensionData>,
                            frameworks: event.frameworks as Record<string, unknown>,
                        };
                        if (reportId) {
                            // setLastReportId(reportId);
                            setCurrentReportId(reportId);
                            setCurrentReportToken((event.token as string) || reportId.slice(-8));
                            localStorage.setItem(LAST_REPORT_KEY, reportId);
                        }
                        setResult(parsed);
                        setStressResult(null);
                        setAuditTimestamp(new Date().toLocaleString());
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
                if (event.type === 'SESSION_INIT' && event.sessionId) {
                    // setCurrentSessionId(event.sessionId); // Assuming setCurrentSessionId is defined elsewhere if needed
                    setHeartbeatLogs([]); // Reset for new session
                }
                if (event.type === 'HEARTBEAT_LOG' && event.log) {
                    setHeartbeatLogs(prev => [...prev, event.log as HeartbeatLog]);
                }

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
                        idBreakdown: event.idBreakdown as { specificity: number; completeness: number; moat: number },
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
                    const orgName = event.orgName as string;
                    const moatRationale = event.moatRationale as string;

                    setResult({
                        analysis_markdown: raw,
                        dimensions: dims || {},
                        orgName,
                        moatRationale,
                        richDimensions: event.richDimensions as Record<string, RichDimensionData>,
                        frameworks: event.frameworks as Record<string, any>,
                    });
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

    const handleShare = async () => {
        if (!currentReportId) return;
        setSharing(true);
        try {
            // Include Firebase auth token if user is signed in
            const authHeader = localStorage.getItem('vcso_auth_token') || 'Bearer dev-token';
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/report/${currentReportId}/share`, {
                method: 'POST',
                headers: { 'Authorization': authHeader }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate share link');

            await navigator.clipboard.writeText(data.shareUrl);
            setShareMessage('Copied to clipboard!');
            setTimeout(() => setShareMessage(''), 3000);
        } catch (err: any) {
            setShareMessage(err.message || 'Share failed');
            setTimeout(() => setShareMessage(''), 3000);
        } finally {
            setSharing(false);
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
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input
                                            type="url"
                                            placeholder="https://company.com (Auto-fill context)"
                                            value={companyUrl}
                                            onChange={e => setCompanyUrl(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={enrichFromUrl}
                                        disabled={!companyUrl || urlEnriching}
                                        className="px-4 py-2 text-xs bg-violet-600/20 border border-violet-500/30 rounded-lg text-violet-300 hover:bg-violet-600/40 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                                    >
                                        {urlEnriching ? 'Scraping...' : urlEnriched ? '✓ Enriched' : 'Auto-fill'}
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 px-1">
                                    <label className="cursor-pointer flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".pdf,.txt,.md"
                                            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                        />
                                        <Paperclip size={14} className="text-violet-400" />
                                        <span>Attach pitch deck or memo</span>
                                    </label>
                                </div>

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

                                {/* Sector + Scale dropdowns */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-gray-500 uppercase tracking-wider pl-1">Sector</label>
                                        <select
                                            value={orgSector}
                                            onChange={(e) => setOrgSector(e.target.value)}
                                            className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors appearance-none cursor-pointer"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                                        >
                                            <option value="">Select sector…</option>
                                            <option value="B2B SaaS">B2B SaaS</option>
                                            <option value="B2C / Consumer">B2C / Consumer</option>
                                            <option value="Marketplace">Marketplace</option>
                                            <option value="EdTech">EdTech</option>
                                            <option value="FinTech">FinTech</option>
                                            <option value="HealthTech">HealthTech</option>
                                            <option value="DeepTech / AI">DeepTech / AI</option>
                                            <option value="eCommerce / D2C">eCommerce / D2C</option>
                                            <option value="Climate / GreenTech">Climate / GreenTech</option>
                                            <option value="Enterprise / Gov">Enterprise / Gov</option>
                                            <option value="Media / Creator">Media / Creator</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs text-gray-500 uppercase tracking-wider pl-1">Organisation Scale</label>
                                        <select
                                            value={orgScale}
                                            onChange={(e) => setOrgScale(e.target.value)}
                                            className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors appearance-none cursor-pointer"
                                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                                        >
                                            <option value="">Select scale…</option>
                                            <option value="Pre-idea / Concept">Pre-idea / Concept</option>
                                            <option value="Pre-revenue Startup">Pre-revenue Startup</option>
                                            <option value="Early Stage (0–$1M ARR)">Early Stage (0–$1M ARR)</option>
                                            <option value="Growth Stage ($1M–$10M ARR)">Growth Stage ($1M–$10M ARR)</option>
                                            <option value="Scale-up ($10M–$50M ARR)">Scale-up ($10M–$50M ARR)</option>
                                            <option value="Enterprise ($50M+ ARR)">Enterprise ($50M+ ARR)</option>
                                        </select>
                                    </div>
                                </div>

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
                            <AgentHeartbeat events={sseEvents} logs={heartbeatLogs} />
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {shareMessage && <span className="text-xs text-emerald-400">{shareMessage}</span>}
                                    <button onClick={handleShare} disabled={sharing}
                                        style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#C4B5FD', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        {sharing ? 'Generating...' : '↗ Share Link'}
                                    </button>
                                </div>
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

                        {/* Body: Responsive Dashboard Layout */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 bg-[radial-gradient(circle_at_50%_-20%,rgba(124,58,237,0.05),transparent)]">

                            {/* Dashboard Shell: KPI & Category Strips */}
                            <div className="w-full max-w-7xl mx-auto space-y-4">
                                <KpiRow
                                    dimensions={stressResult ? stressResult.stressedScores : (result.dimensions || {})}
                                    richDimensions={result.richDimensions}
                                />
                                <CategorySummary dimensions={stressResult ? stressResult.stressedScores : (result.dimensions || {})} />
                                <ReportTabs activeTab={activeTab} onTabChange={setActiveTab} />
                            </div>

                            {activeTab === 'overview' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-12"
                                >
                                    {/* Audit Brief Card */}
                                    <div className="max-w-7xl mx-auto w-full">
                                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Audit Brief</span>
                                                    {urlEnriched && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                                            🌐 URL Enriched
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {clarification?.usedLenses?.[0] && (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-500/10 border border-violet-500/20 text-violet-400">
                                                            {clarification.usedLenses[0]}
                                                        </span>
                                                    )}
                                                    {clarification?.usedLenses?.[1] && (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-500/10 border border-violet-500/20 text-violet-400">
                                                            {clarification.usedLenses[1]}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
                                                {/* Left: context preview */}
                                                <div>
                                                    <p
                                                        className="text-sm text-zinc-400 leading-relaxed"
                                                        style={briefExpanded ? undefined : {
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 3,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        {context}
                                                    </p>
                                                    <button
                                                        onClick={() => setBriefExpanded(v => !v)}
                                                        className="mt-2 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                                                    >
                                                        {briefExpanded ? 'Show less ↑' : 'Show more ↓'}
                                                    </button>
                                                </div>

                                                {/* Right: metadata */}
                                                <div className="shrink-0 flex flex-col gap-3 min-w-[190px] border-t md:border-t-0 md:border-l border-zinc-800/50 pt-4 md:pt-0 md:pl-6">
                                                    <div>
                                                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Submitted</p>
                                                        <p className="text-xs text-zinc-300 font-mono">{auditTimestamp || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Audit ID</p>
                                                        <p className="text-xs text-zinc-300 font-mono">{currentReportId?.slice(-8) ?? '—'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Information Density</p>
                                                        <p className="text-xs text-zinc-300 font-mono">
                                                            {clarification?.idScore
                                                                ? `${clarification.idScore}/100`
                                                                : 'Auto-grounded'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Zone 1: Executive Glance */}
                                    <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-stretch max-w-7xl mx-auto w-full relative">
                                        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 md:p-10 backdrop-blur-xl flex flex-col items-center justify-center min-h-[400px] lg:min-h-[500px]">
                                            <div className="w-full flex justify-between items-center mb-6">
                                                <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Strategic Position Matrix</h3>
                                                <div className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] text-purple-400 font-bold uppercase tracking-wider">Live Audit</div>
                                            </div>
                                            <div className="flex-1 flex items-center justify-center w-full">
                                                <StrategyRadar
                                                    dimensions={stressResult ? stressResult.stressedScores : (result.dimensions || {})}
                                                    originalDimensions={stressResult ? result.dimensions : undefined}
                                                />
                                            </div>
                                        </div>

                                        <ExecutiveSummaryCard
                                            orgName={result.orgName || 'Strategic Audit Result'}
                                            moatRationale={result.moatRationale || 'Top-tier competitive moat identified through asymmetric multi-agentic analysis.'}
                                            dimensions={result.dimensions || {}}
                                            richDimensions={result.richDimensions}
                                        />
                                    </section>

                                    {/* Zone 2: Deep Analysis & Risk Propagation */}
                                    <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start max-w-7xl mx-auto w-full">
                                        <div className="space-y-6">
                                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-xl">
                                                <div className="report-content prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-zinc-300 prose-p:leading-relaxed prose-strong:text-white prose-pre:bg-zinc-900">
                                                    <ReactMarkdown
                                                        components={{
                                                            h1: ({ children }) => <h1 className="text-3xl font-bold text-white mb-6 mt-10">{children}</h1>,
                                                            h2: ({ children }) => <h2 className="text-xl font-bold text-violet-300 mb-4 mt-8 uppercase tracking-wider">{children}</h2>,
                                                            h3: ({ children }) => <h3 className="text-lg font-bold text-white mb-3 mt-6">{children}</h3>,
                                                            p: ({ children }) => {
                                                                const text = String(children);
                                                                if (text.toLowerCase().includes('asymmetric play')) {
                                                                    return <AsymmetricCard>{children}</AsymmetricCard>;
                                                                }
                                                                if (text.startsWith('Because ') && (text.includes(' cannot ') || text.includes(' can\'t '))) {
                                                                    return <SavvyRecommendation>{children}</SavvyRecommendation>;
                                                                }
                                                                return <p className="mb-4 leading-relaxed">{children}</p>;
                                                            }
                                                        }}
                                                    >
                                                        {sanitizeReport(result.analysis_markdown || '')}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <StressTestPanel
                                                reportId={currentReportId || ''}
                                                onStressResult={handleStressResult}
                                                apiBase={import.meta.env.VITE_API_URL || ''}
                                            />
                                        </div>
                                    </section>
                                </motion.div>
                            )}

                            {activeTab === 'matrix' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="max-w-7xl mx-auto w-full"
                                >
                                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 backdrop-blur-xl">
                                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800/50">
                                            <div>
                                                <h3 className="text-white font-bold text-xl">
                                                    {stressResult ? stressResult.scenarioLabel : 'Detailed Dimension Matrix'}
                                                </h3>
                                                <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${stressResult ? 'text-rose-500' : 'text-zinc-500'}`}>
                                                    {stressResult ? 'Dimensional Decay Analysis' : 'Full Strategic Coverage'}
                                                </p>
                                            </div>
                                            <div className={`px-4 py-1.5 rounded-full border ${stressResult ? 'bg-rose-500/10 border-rose-500/20' : 'bg-zinc-500/10 border-zinc-500/20'}`}>
                                                <span className={`text-[10px] font-bold tracking-wider uppercase ${stressResult ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                    {stressResult ? 'Crisis Impact' : 'Baseline Verified'}
                                                </span>
                                            </div>
                                        </div>
                                        <DiagnosticScorecard
                                            dimensions={stressResult ? stressResult.stressedScores : (result.dimensions || {})}
                                            originalDimensions={stressResult ? result.dimensions : undefined}
                                            richDimensions={result.richDimensions}
                                            onAreaClick={(dim: string) => console.log('Matrix Area:', dim)}
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'frameworks' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="max-w-7xl mx-auto w-full space-y-12"
                                >
                                    {result.frameworks?.unit_economics ? (
                                        <UnitEconomicsDashboard data={result.frameworks.unit_economics} />
                                    ) : (
                                        <PlaceholderCard
                                            icon={ShieldAlert}
                                            title="Unit Economics Blocked"
                                            description="Insufficient LTV/CAC signal depth to model unit economics. Provide specific pricing and customer acquisition data to unlock this view."
                                        />
                                    )}

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {result.frameworks?.five_forces && <FiveForces data={result.frameworks.five_forces} />}
                                        {result.frameworks?.wardley && (
                                            <WardleyMap
                                                capabilities={result.frameworks.wardley.capabilities}
                                                warnings={result.frameworks.wardley.strategic_warnings}
                                            />
                                        )}
                                        {result.frameworks?.ansoffMatrix && <AnsoffMatrix data={result.frameworks.ansoffMatrix} />}
                                        {result.frameworks?.vrioAnalysis && <VrioCard data={result.frameworks.vrioAnalysis} />}
                                    </div>

                                    {result.frameworks?.monte_carlo ? (
                                        <MonteCarloChart
                                            distributions={result.frameworks.monte_carlo.distributions}
                                            riskDrivers={result.frameworks.monte_carlo.risk_drivers}
                                        />
                                    ) : (
                                        <PlaceholderCard
                                            icon={ShieldAlert}
                                            title="Monte Carlo Blocked"
                                            description="Probabilistic risk modeling requires revenue and growth rate distributions. Add financial targets to simulate variance scenarios."
                                        />
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'synthesis' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="max-w-7xl mx-auto w-full"
                                >
                                    {result.frameworks?.blue_ocean && (
                                        <BlueOceanCanvas data={result.frameworks.blue_ocean} />
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )
                }
            </AnimatePresence >
        </section >
    );
}
