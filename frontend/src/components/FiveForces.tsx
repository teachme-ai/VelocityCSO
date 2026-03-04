import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { FiveForcesData } from '../types/frameworks';

const FORCE_LABELS: Record<string, string> = {
    competitive_rivalry: 'Rivalry',
    threat_of_new_entrants: 'New Entrants',
    threat_of_substitutes: 'Substitutes',
    buyer_power: 'Buyer Power',
    supplier_power: 'Supplier Power',
};

export function FiveForces({ data }: { data: FiveForcesData }) {
    if (!data || !data.scores) return null;

    const radarData = Object.entries(data.scores).map(([key, val]) => ({
        force: FORCE_LABELS[key] || key,
        intensity: val.score,
        driver: val.primary_driver,
    }));

    const attractiveness = data.structural_attractiveness_score;
    const attrColor = attractiveness >= 60 ? '#10b981' : attractiveness >= 40 ? '#f59e0b' : '#ef4444';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Porter's Five Forces</h3>
                <div className="text-right">
                    <div className="text-xs text-gray-400">Structural Attractiveness</div>
                    <div className="text-2xl font-bold" style={{ color: attrColor }}>
                        {attractiveness}/100
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e2a3a" />
                    <PolarAngleAxis dataKey="force" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Radar name="Intensity" dataKey="intensity" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                    <Tooltip
                        content={({ payload }) => {
                            if (!payload?.length) return null;
                            const item = payload[0].payload;
                            return (
                                <div className="bg-gray-900 border border-gray-700 p-3 rounded text-xs max-w-48">
                                    <p className="font-semibold text-white mb-1">{item.force}</p>
                                    <p className="text-red-400">Intensity: {item.intensity}/100</p>
                                    <p className="text-gray-300 mt-1">{item.driver}</p>
                                </div>
                            );
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>

            {data.interaction_effect_warning && (
                <div className="glass-card p-3 border border-red-500/30 text-sm text-red-300">
                    ⚠️ {data.interaction_effect_warning}
                </div>
            )}

            <div className="space-y-2">
                {Object.entries(data.scores).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-400 w-32 shrink-0">{FORCE_LABELS[key] || key}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                            <div
                                className="h-2 rounded-full"
                                style={{
                                    width: `${val.score}%`,
                                    background: val.score > 70 ? '#ef4444' : val.score > 40 ? '#f59e0b' : '#10b981'
                                }}
                            />
                        </div>
                        <span className="text-gray-300 w-8 text-right font-mono">{val.score}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
