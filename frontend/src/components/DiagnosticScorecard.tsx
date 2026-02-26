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
        <div className="w-full rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-sm font-semibold mb-4 uppercase tracking-widest"
                style={{ color: isStressMode ? '#f97316' : '#a855f7' }}>
                {isStressMode ? '⚡ Stressed Dimension Matrix' : '15-Dimension Strategy Matrix'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
                {Object.entries(CATEGORIES).map(([cat, dims]) => (
                    <div key={cat}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 mt-3">{cat}</p>
                        {dims.map(dim => {
                            const score = dimensions[dim] ?? 0;
                            const baseline = originalDimensions?.[dim] ?? score;
                            const dropped = isStressMode && (baseline - score) > 15;
                            const color = score >= 70 ? '#16a34a' : score >= 40 ? '#2563eb' : '#dc2626';
                            return (
                                <div key={dim} className="flex items-center gap-2 mb-2 cursor-pointer group" onClick={() => onAreaClick(dim)}>
                                    <span className={`text-xs w-40 shrink-0 truncate group-hover:text-white transition-colors ${dropped ? 'text-amber-400 font-semibold' : 'text-gray-400'}`}>
                                        {dropped ? `⚠ ${dim}` : dim}
                                    </span>
                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${score}%`, background: color }} />
                                    </div>
                                    <span className="text-xs font-mono w-7 text-right shrink-0" style={{ color }}>{score}</span>
                                    {isStressMode && dropped && (
                                        <span className="text-[10px] text-red-400 shrink-0">↓{baseline - score}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};
