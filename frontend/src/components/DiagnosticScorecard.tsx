import { useState } from 'react';

interface ScorecardProps {
    dimensions: Record<string, number>;
    originalDimensions?: Record<string, number>;
    richDimensions?: Record<string, any>;
    onAreaClick: (area: string) => void;
}

const CATEGORIES: Record<string, string[]> = {
    'Market': ['TAM Viability', 'Target Precision', 'Trend Adoption', 'Team / Founder Strength'],
    'Strategy': ['Competitive Defensibility', 'Model Innovation', 'Flywheel Potential', 'Network Effects Strength', 'Data Asset Quality'],
    'Commercial': ['Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed'],
    'Operations': ['Execution Speed', 'Scalability', 'ESG Posture', 'Regulatory Readiness'],
    'Finance': ['ROI Projection', 'Risk Tolerance', 'Capital Efficiency', 'Customer Concentration Risk'],
};

export const DiagnosticScorecard = ({ dimensions, originalDimensions, richDimensions, onAreaClick }: ScorecardProps) => {
    const isStressMode = !!originalDimensions;
    const [selectedDim, setSelectedDim] = useState<string | null>(null);

    return (
        <div style={{
            width: '100%',
            borderRadius: 12,
            padding: '12px 16px',
            background: isStressMode ? 'rgba(220,38,38,0.05)' : 'rgba(255,255,255,0.02)',
            border: isStressMode ? '1px solid rgba(220,38,38,0.3)' : '1px solid transparent',
            transition: 'all 0.5s ease',
            boxShadow: isStressMode ? '0 0 20px rgba(220,38,38,0.1)' : 'none'
        }}>
            <style>
                {`
                    @keyframes crisis-pulse {
                        0% { opacity: 0.6; }
                        50% { opacity: 1; }
                        100% { opacity: 0.6; }
                    }
                `}
            </style>
            <p style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: isStressMode ? '#ef4444' : '#a855f7',
                marginBottom: 12,
                animation: isStressMode ? 'crisis-pulse 2s infinite ease-in-out' : 'none'
            }}>
                {isStressMode ? '⚠ CRITICAL: Stressed Dimension Matrix' : '20-Dimension Strategy Matrix'}
            </p>
            {Object.entries(CATEGORIES).map(([cat, dims]) => (
                <div key={cat} style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6, marginTop: 10 }}>{cat}</p>
                    {dims.map(dim => {
                        const score = dimensions[dim] ?? 0;
                        const baseline = originalDimensions?.[dim] ?? score;
                        const dropped = isStressMode && (baseline - score) > 15;
                        const color = score >= 70 ? '#16a34a' : score >= 40 ? '#2563eb' : '#dc2626';
                        return (
                            <div key={dim}>
                                <div
                                    onClick={() => {
                                        setSelectedDim(selectedDim === dim ? null : dim);
                                        onAreaClick(dim);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginBottom: 6,
                                        cursor: 'pointer',
                                        padding: '6px 8px',
                                        borderRadius: 8,
                                        background: selectedDim === dim ? 'rgba(255,255,255,0.05)' : 'transparent',
                                        border: selectedDim === dim ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ fontSize: 11, width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: dropped ? '#fbbf24' : '#9ca3af', fontWeight: dropped ? 600 : 400 }}>
                                        {dropped ? `⚠ ${dim}` : dim}
                                    </span>
                                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                                        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 0.7s' }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontFamily: 'monospace', width: 26, textAlign: 'right', flexShrink: 0, color }}>{score}</span>
                                    {isStressMode && dropped && (
                                        <span style={{ fontSize: 9, color: '#f87171', flexShrink: 0, width: 28 }}>↓{baseline - score}</span>
                                    )}
                                </div>
                                {selectedDim === dim && richDimensions?.[dim] && (
                                    <div style={{ marginLeft: 8, marginBottom: 12, padding: '12px', background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${color}`, borderRadius: '0 8px 8px 0', border: '1px solid rgba(255,255,255,0.05)', borderLeftWidth: 2 }}>
                                        {richDimensions[dim].justification && (
                                            <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginBottom: 8 }}>
                                                <span style={{ color: '#fff', fontWeight: 600 }}>Rationale:</span> {richDimensions[dim].justification}
                                            </p>
                                        )}
                                        {richDimensions[dim].improvement_action && (
                                            <div style={{ padding: '8px 10px', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 6 }}>
                                                <p style={{ fontSize: 10, color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>90-Day Tactical Move</p>
                                                <p style={{ fontSize: 11, color: '#bfdbfe', lineHeight: 1.4 }}>{richDimensions[dim].improvement_action}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};
