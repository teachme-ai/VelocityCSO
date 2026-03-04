import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface AuditSnapshot {
    date: string;
    dimensions: Record<string, number>;
    reportId: string;
}

interface AuditHistoryProps {
    trend: AuditSnapshot[];
    onSelectAudit: (reportId: string) => void;
}

// Key dimensions to show in trend chart (show top 5 by variance)
function getTopVarianceDimensions(trend: AuditSnapshot[]): string[] {
    if (trend.length < 2) return Object.keys(trend[0]?.dimensions ?? {}).slice(0, 5);

    const dims = Object.keys(trend[0].dimensions);
    return dims
        .map(dim => {
            const values = trend.map(t => t.dimensions[dim] ?? 0);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
            return { dim, variance };
        })
        .sort((a, b) => b.variance - a.variance)
        .slice(0, 5)
        .map(d => d.dim);
}

const TREND_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export function AuditHistory({ trend, onSelectAudit }: AuditHistoryProps) {
    if (trend.length === 0) {
        return (
            <div className="glass-card p-8 text-center text-gray-400">
                No audit history yet. Run your first audit to start tracking trends.
            </div>
        );
    }

    const trackedDims = getTopVarianceDimensions(trend);
    const chartData = trend.map(t => ({
        date: format(new Date(t.date), 'MMM d'),
        ...Object.fromEntries(trackedDims.map(d => [d, t.dimensions[d] ?? 0])),
        reportId: t.reportId,
    }));

    // Find dimensions with >10 point drop between last two audits
    const driftAlerts: string[] = [];
    if (trend.length >= 2) {
        const latest = trend[trend.length - 1].dimensions;
        const previous = trend[trend.length - 2].dimensions;
        for (const [dim, score] of Object.entries(latest)) {
            const prev = previous[dim] ?? score;
            if (prev - score > 10) {
                driftAlerts.push(`${dim.replace(/_/g, ' ')}: dropped ${(prev - score).toFixed(0)} pts`);
            }
        }
    }

    return (
        <div className="space-y-6">
            {driftAlerts.length > 0 && (
                <div className="glass-card p-4 border border-amber-500/30">
                    <h4 className="text-sm font-semibold text-amber-400 mb-2">⚠ Dimension Drift Alerts</h4>
                    <ul className="space-y-1">
                        {driftAlerts.map(alert => (
                            <li key={alert} className="text-sm text-amber-300">• {alert}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-white mb-4">
                    Dimension Trend — Top {trackedDims.length} by Volatility
                </h4>
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#0f1829', border: '1px solid #1e2a3a' }} />
                        <Legend />
                        {trackedDims.map((dim, i) => (
                            <Line key={dim} type="monotone" dataKey={dim} stroke={TREND_COLORS[i]}
                                strokeWidth={2} dot={{ r: 4 }} name={dim.replace(/_/g, ' ')} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">Audit Log</h4>
                {[...trend].reverse().map(snapshot => (
                    <button key={snapshot.reportId}
                        onClick={() => onSelectAudit(snapshot.reportId)}
                        className="w-full glass-card p-3 flex justify-between items-center hover:border-violet-500/40 transition-colors text-left">
                        <span className="text-sm text-gray-300">
                            {format(new Date(snapshot.date), 'MMM d, yyyy HH:mm')}
                        </span>
                        <span className="text-sm text-violet-400 font-semibold">
                            Avg: {(Object.values(snapshot.dimensions).reduce((a, b) => a + b, 0) /
                                Object.keys(snapshot.dimensions).length).toFixed(0)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
