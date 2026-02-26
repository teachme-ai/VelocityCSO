import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ShieldAlert } from 'lucide-react';
import { DiagnosticScorecard } from './DiagnosticScorecard';
import { StressTestPanel } from './StressTestPanel';
import type { StressResult } from '../types/stress';

type ReportData = {
    analysis_markdown?: string;
    dimensions?: Record<string, number>;
    confidence_score?: number;
};

interface ReportPageProps {
    result: ReportData;
    reportId: string | null;
    reportToken: string | null;
    apiBase: string;
    onClose: () => void;
}

function renderMarkdown(raw: string) {
    return raw
        .replace(/^## Dimension Scores.*$/im, '')
        .replace(/^(TAM Viability|Target Precision|Trend Adoption|Competitive Defensibility|Model Innovation|Flywheel Potential|Pricing Power|CAC\/LTV Ratio|Market Entry Speed|Execution Speed|Scalability|ESG Posture|ROI Projection|Risk Tolerance|Capital Efficiency)[^\n]*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .split('\n')
        .map((line, i) => {
            if (/^#{1,2}\s/.test(line)) return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 20, marginBottom: 6, borderLeft: '2px solid #7c3aed', paddingLeft: 10 }}>{line.replace(/^#+\s*/, '')}</h3>;
            if (/^###\s/.test(line)) return <h4 key={i} style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', marginTop: 12, marginBottom: 4 }}>{line.replace(/^#+\s*/, '')}</h4>;
            if (/^[-*]\s/.test(line)) return (
                <p key={i} style={{ display: 'flex', gap: 8, color: '#d1d5db', fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>
                    <span style={{ color: '#7c3aed', flexShrink: 0 }}>•</span>
                    <span dangerouslySetInnerHTML={{ __html: line.replace(/^[-*]\s*/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                </p>
            );
            if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
            return <p key={i} style={{ color: '#d1d5db', fontSize: 13, lineHeight: 1.6, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />;
        });
}

export function ReportPage({ result, reportId, reportToken, apiBase, onClose }: ReportPageProps) {
    const [stressResult, setStressResult] = useState<StressResult | null>(null);

    const dims = result.dimensions && Object.keys(result.dimensions).length > 0 ? result.dimensions : null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#0a0a0f', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
                    <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>Strategy Intelligence Report</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {reportId && reportToken && (
                        <a
                            href={`/report/${reportId}/download?token=${reportToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.4)', color: '#93c5fd', textDecoration: 'none' }}
                        >
                            ↓ Board-Ready PDF
                        </a>
                    )}
                    <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Body — 2 columns */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* LEFT PANEL — Scorecard + Stress Test */}
                <div style={{ width: 420, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: '20px 20px' }}>
                    {dims ? (
                        <>
                            <DiagnosticScorecard
                                dimensions={stressResult ? stressResult.stressedScores : dims}
                                originalDimensions={stressResult ? dims : undefined}
                                onAreaClick={() => {}}
                            />
                            <div style={{ marginTop: 24 }}>
                                {reportId && (
                                    <StressTestPanel
                                        reportId={reportId}
                                        originalScores={dims}
                                        onStressResult={setStressResult}
                                        apiBase={apiBase}
                                    />
                                )}
                            </div>
                        </>
                    ) : (
                        reportId && (
                            <StressTestPanel
                                reportId={reportId}
                                originalScores={{}}
                                onStressResult={setStressResult}
                                apiBase={apiBase}
                            />
                        )
                    )}
                </div>

                {/* RIGHT PANEL — Report text */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                    {result.confidence_score && result.confidence_score < 70 && (
                        <div style={{ display: 'flex', gap: 12, padding: 14, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, marginBottom: 20 }}>
                            <ShieldAlert size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#fcd34d', marginBottom: 2 }}>Strategic Blindspot Detected</p>
                                <p style={{ fontSize: 11, color: 'rgba(252,211,77,0.7)' }}>Confidence: {result.confidence_score}/100. Critic flagged contradictions or insufficient data.</p>
                            </div>
                        </div>
                    )}
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#34d399', marginBottom: 16 }}>Executive Synthesis</p>
                    <div>{renderMarkdown(result.analysis_markdown || '')}</div>
                </div>
            </div>
        </motion.div>
    );
}
