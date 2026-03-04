import type { MonteCarloDistribution } from '../types/frameworks';

export function MonteCarloChart({ distributions, riskDrivers }: {
    distributions: MonteCarloDistribution[];
    riskDrivers: Array<{ factor: string; variance_contribution: number }>;
}) {
    if (!distributions || distributions.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="mb-2">
                <h3 className="text-lg font-semibold text-white">Probabilistic Outcomes</h3>
                <p className="text-xs text-gray-400">Based on 5,000 simulation runs across your key variable ranges</p>
            </div>

            {distributions.map(dist => (
                <div key={dist.metric} className="glass-card p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-gray-300">{dist.metric}</h4>
                        <span className="text-xs px-2 py-1 rounded"
                            style={{
                                background: dist.probability_of_failure > 0.3 ? '#ef444420' : '#10b98120',
                                color: dist.probability_of_failure > 0.3 ? '#ef4444' : '#10b981'
                            }}>
                            {(dist.probability_of_failure * 100).toFixed(0)}% failure risk
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        {[
                            { label: 'Pessimistic (P10)', value: dist.p10, color: '#ef4444' },
                            { label: 'Median (P50)', value: dist.p50, color: '#f59e0b' },
                            { label: 'Optimistic (P90)', value: dist.p90, color: '#10b981' },
                        ].map(p => (
                            <div key={p.label} className="space-y-1">
                                <div className="text-xl font-bold" style={{ color: p.color }}>
                                    {typeof p.value === 'number' ? p.value.toFixed(1) : '–'}x
                                </div>
                                <div className="text-xs text-gray-500">{p.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {riskDrivers && riskDrivers.length > 0 && (
                <div className="glass-card p-4">
                    <h4 className="text-sm font-semibold text-white mb-3">Key Risk Drivers</h4>
                    {riskDrivers.map(d => (
                        <div key={d.factor} className="flex items-center gap-3 mb-2 text-sm">
                            <span className="text-gray-400 w-28 shrink-0">{d.factor}</span>
                            <div className="flex-1 bg-gray-800 rounded-full h-2">
                                <div className="h-2 rounded-full bg-amber-500" style={{ width: `${d.variance_contribution}%` }} />
                            </div>
                            <span className="text-gray-300 w-10 text-right">{d.variance_contribution}%</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
