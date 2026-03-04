import type { WardleyCapability } from '../types/frameworks';

const EVOLUTION_LABELS = ['Genesis', 'Custom Built', 'Product', 'Commodity'];
const BUILD_BUY_COLORS = {
    build: '#8b5cf6',
    buy: '#10b981',
    partner: '#f59e0b',
    outsource: '#6b7280',
};

export function WardleyMap({ capabilities, warnings }: {
    capabilities: WardleyCapability[];
    warnings: string[];
}) {
    if (!capabilities || capabilities.length === 0) return null;

    const W = 600, H = 400;
    const PAD = { top: 30, right: 20, bottom: 50, left: 50 };

    const toX = (evolution: number) =>
        PAD.left + (evolution / 100) * (W - PAD.left - PAD.right);
    const toY = (position: number) =>
        PAD.top + ((100 - position) / 100) * (H - PAD.top - PAD.bottom);

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Wardley Map</h3>
            <p className="text-xs text-gray-400">
                X-axis: Evolution (Genesis → Commodity) · Y-axis: Visibility (Infrastructure → User)
            </p>

            <div className="glass-card p-4 overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 400 }}>
                    {/* Evolution axis labels */}
                    {EVOLUTION_LABELS.map((label, i) => (
                        <text key={label} x={PAD.left + (i / 3) * (W - PAD.left - PAD.right)}
                            y={H - 10} fill="#6b7280" fontSize={10} textAnchor="middle">
                            {label}
                        </text>
                    ))}

                    {/* Grid lines */}
                    {[0, 33, 66, 100].map(v => (
                        <line key={v} x1={toX(v)} x2={toX(v)} y1={PAD.top} y2={H - PAD.bottom}
                            stroke="#1e2a3a" strokeDasharray="3 3" />
                    ))}

                    {/* Dependency arrows */}
                    {capabilities.flatMap(cap =>
                        cap.dependency_ids ? cap.dependency_ids.map(depId => {
                            const dep = capabilities.find(c => c.id === depId);
                            if (!dep) return null;
                            return (
                                <line key={`${cap.id}-${depId}`}
                                    x1={toX(cap.evolution)} y1={toY(cap.value_chain_position)}
                                    x2={toX(dep.evolution)} y2={toY(dep.value_chain_position)}
                                    stroke="#374151" strokeWidth={1} />
                            );
                        }) : []
                    )}

                    {/* Capability nodes */}
                    {capabilities.map(cap => (
                        <g key={cap.id} transform={`translate(${toX(cap.evolution)},${toY(cap.value_chain_position)})`}>
                            <circle r={cap.is_differentiator ? 10 : 6}
                                fill={BUILD_BUY_COLORS[cap.build_buy_partner] || '#374151'}
                                fillOpacity={0.8}
                                stroke={cap.will_commoditize_in_18m ? '#ef4444' : 'transparent'}
                                strokeWidth={2} />
                            <text y={-14} textAnchor="middle" fill="#e5e7eb" fontSize={9}>
                                {cap.name}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs">
                {Object.entries(BUILD_BUY_COLORS).map(([action, color]) => (
                    <div key={action} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                        <span className="text-gray-400 capitalize">{action}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full border-2 border-red-500" />
                    <span className="text-gray-400">Commoditizing soon</span>
                </div>
            </div>

            {/* Warnings */}
            {warnings && warnings.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-red-400">Strategic Warnings</h4>
                    {warnings.map((w, i) => (
                        <div key={i} className="glass-card p-3 border border-red-500/20 text-sm text-red-300">
                            ⚠️ {w}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
