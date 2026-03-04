import type { BlueOceanResult, CompetitiveFactor } from '../types/frameworks';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BlueOceanCanvasProps {
    data: BlueOceanResult;
}

export function BlueOceanCanvas({ data }: BlueOceanCanvasProps) {
    if (!data || !data.industry_factors) return null;

    // Transform for Recharts LineChart
    const chartData = data.industry_factors.map((f: CompetitiveFactor) => ({
        factor: f.name,
        'Your Business': f.businessScore,
        [data.competitor_names[0]]: f.competitor1Score,
        [data.competitor_names[1]]: f.competitor2Score,
        'Customer Priority': f.customerImportance,
    }));

    const errcColors = {
        eliminate: '#ef4444',  // red
        reduce: '#f97316',     // orange
        raise: '#10b981',      // green
        create: '#8b5cf6',     // purple
    };

    return (
        <div className="space-y-6">
            {/* Value Curve Chart */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                    Strategic Canvas — {data.strategic_canvas_title || 'Value Curve Analysis'}
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                        <XAxis dataKey="factor" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" height={70} />
                        <YAxis domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#0f1829', border: '1px solid #1e2a3a' }} />
                        <Legend />
                        <Line type="monotone" dataKey="Your Business" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
                        <Line type="monotone" dataKey={data.competitor_names[0]} stroke="#374151" strokeWidth={2} strokeDasharray="5 5" />
                        <Line type="monotone" dataKey={data.competitor_names[1]} stroke="#374151" strokeWidth={2} strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="Customer Priority" stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 2" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* ERRC Grid */}
            <div className="grid grid-cols-2 gap-4">
                {(Object.entries(data.errc_grid) as [keyof typeof errcColors, string[]][]).map(([quadrant, items]) => (
                    <div key={quadrant} className="glass-card p-4">
                        <h4 className="text-sm font-bold uppercase tracking-wider mb-3"
                            style={{ color: errcColors[quadrant] }}>
                            {quadrant}
                        </h4>
                        <ul className="space-y-2">
                            {items && items.length > 0 ? items.map((item, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                    <span style={{ color: errcColors[quadrant] }} className="mt-0.5">▸</span>
                                    {item}
                                </li>
                            )) : (
                                <li className="text-sm text-gray-500 italic">None identified</li>
                            )}
                        </ul>
                    </div>
                ))}
            </div>

            {/* Opportunity Statement */}
            <div className="glass-card p-4 border border-violet-500/30">
                <p className="text-sm text-violet-300 italic">{data.blue_ocean_opportunity}</p>
                <p className="text-sm text-gray-400 mt-2">{data.value_curve_summary}</p>
            </div>
        </div>
    );
}
