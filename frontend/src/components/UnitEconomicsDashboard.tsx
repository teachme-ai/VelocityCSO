import type { UnitEconomicsData } from '../types/frameworks';

const STATUS_COLORS = { GREEN: '#10b981', AMBER: '#f59e0b', RED: '#ef4444' };
const STATUS_BG = { GREEN: 'bg-emerald-500/10', AMBER: 'bg-amber-500/10', RED: 'bg-red-500/10' };

const METRIC_LABELS: Record<string, string> = {
    ltv_cac: 'LTV : CAC',
    cac_payback_months: 'CAC Payback',
    gross_margin_pct: 'Gross Margin',
    rule_of_40: 'Rule of 40',
    burn_multiple: 'Burn Multiple',
    magic_number: 'Magic Number',
};

export function UnitEconomicsDashboard({ data }: { data: UnitEconomicsData }) {
    if (!data || !data.metrics) return null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(data.metrics).map(([key, metric]) => (
                    <div key={key} className={`glass-card p-4 ${STATUS_BG[metric.status] || 'bg-gray-800'}`}>
                        <div className="text-xs text-gray-400 mb-1">{METRIC_LABELS[key] ?? key}</div>
                        <div className="text-xl font-bold mb-1" style={{ color: STATUS_COLORS[metric.status] || '#fff' }}>
                            {metric.value ?? '—'}
                        </div>
                        <div className="text-xs text-gray-500">Benchmark: {metric.benchmark}</div>
                        <div className="text-xs text-gray-400 mt-1">{metric.note}</div>
                    </div>
                ))}
            </div>

            {/* Sensitivity Table */}
            {data.sensitivity && (
                <div className="glass-card p-4">
                    <h4 className="text-sm font-semibold text-white mb-3">LTV:CAC Sensitivity</h4>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 text-xs">
                                <th className="text-left pb-2">Scenario</th>
                                <th className="text-right pb-2">LTV:CAC</th>
                                <th className="text-right pb-2">Change</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-1">
                            {[
                                { label: 'Base case', key: 'base_ltv_cac' },
                                { label: 'ARPU −20%', key: 'arpu_down_20pct' },
                                { label: 'Churn +50%', key: 'churn_up_50pct' },
                                { label: 'CAC +30%', key: 'cac_up_30pct' },
                            ].map(row => {
                                const val = data.sensitivity[row.key as keyof typeof data.sensitivity];
                                const base = data.sensitivity.base_ltv_cac;
                                const delta = typeof val === 'number' && typeof base === 'number' ? val - base : 0;
                                return (
                                    <tr key={row.key} className="border-t border-white/5">
                                        <td className="py-2 text-gray-300">{row.label}</td>
                                        <td className="py-2 text-right font-mono">{typeof val === 'number' ? val.toFixed(1) : '–'}x</td>
                                        <td className="py-2 text-right font-mono"
                                            style={{ color: delta >= 0 ? '#10b981' : '#ef4444' }}>
                                            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {data.assumptions && data.assumptions.length > 0 && (
                <div className="text-xs text-gray-500 space-y-1">
                    <p className="font-semibold text-gray-400">Assumptions:</p>
                    {data.assumptions.map((a, i) => <p key={i}>• {a}</p>)}
                </div>
            )}
        </div>
    );
}
