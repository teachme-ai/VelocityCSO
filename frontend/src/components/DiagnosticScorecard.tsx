interface ScorecardProps {
    dimensions: Record<string, number>;
    originalDimensions?: Record<string, number>;
    onAreaClick: (area: string) => void;
}

const CATEGORIES: Record<string, string[]> = {
    'Market':     ['TAM Viability', 'Target Precision', 'Trend Adoption'],
    'Strategy':   ['Competitive Defensibility', 'Model Innovation', 'Flywheel Potential'],
    'Commercial': ['Pricing Power', 'CAC/LTV Ratio', 'Market Entry Speed'],
    'Operations': ['Execution Speed', 'Scalability', 'ESG Posture'],
    'Finance':    ['ROI Projection', 'Risk Tolerance', 'Capital Efficiency'],
};

export const DiagnosticScorecard = ({ dimensions, originalDimensions, onAreaClick }: ScorecardProps) => {
    const isStressMode = !!originalDimensions;

    return (
        <div style={{ width: '100%', borderRadius: 12, padding: '12px 0', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: isStressMode ? '#f97316' : '#a855f7', marginBottom: 12 }}>
                {isStressMode ? '⚡ Stressed Dimension Matrix' : '15-Dimension Strategy Matrix'}
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
                            <div key={dim} onClick={() => onAreaClick(dim)}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
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
                        );
                    })}
                </div>
            ))}
        </div>
    );
};
