interface Action {
    title: string;
    owner: string;
    success_metric: string;
    why_now: string;
    dimension_reference: string;
    status: 'not_started' | 'in_progress' | 'done';
}

interface RoadmapData {
    phase_1_30: Action[];
    phase_31_60: Action[];
    phase_61_90: Action[];
}

const PHASE_CONFIG = [
    { key: 'phase_1_30', label: 'Days 1-30', subtitle: 'Quick Wins', color: '#10b981' },
    { key: 'phase_31_60', label: 'Days 31-60', subtitle: 'Foundation', color: '#8b5cf6' },
    { key: 'phase_61_90', label: 'Days 61-90', subtitle: 'Strategic Bets', color: '#f59e0b' },
];

export function ActionRoadmap({ roadmap, reportId }: { roadmap: RoadmapData; reportId: string }) {
    // Status is stored in localStorage per report+action
    const getStatus = (actionKey: string) =>
        (localStorage.getItem(`${reportId}_${actionKey}`) ?? 'not_started') as Action['status'];

    const setStatus = (actionKey: string, status: Action['status']) => {
        localStorage.setItem(`${reportId}_${actionKey}`, status);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">90-Day Strategic Roadmap</h2>
            {PHASE_CONFIG.map(phase => {
                const actions = roadmap[phase.key as keyof RoadmapData] ?? [];
                return (
                    <div key={phase.key} className="glass-card p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-2 h-8 rounded" style={{ background: phase.color }} />
                            <div>
                                <h3 className="font-semibold text-white">{phase.label}</h3>
                                <p className="text-xs text-gray-400">{phase.subtitle}</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {actions.map((action, i) => {
                                const key = `${phase.key}_${i}`;
                                return (
                                    <div key={key} className="bg-white/5 rounded-lg p-3 space-y-2 relative group hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="text-sm font-semibold text-white">{action.title}</p>
                                            <select
                                                defaultValue={getStatus(key)}
                                                onChange={e => setStatus(key, e.target.value as Action['status'])}
                                                className="text-xs bg-transparent border border-white/10 rounded px-2 py-1 text-gray-400 opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus:border-violet-500"
                                            >
                                                <option value="not_started">Not Started</option>
                                                <option value="in_progress">In Progress...</option>
                                                <option value="done">Done ✓</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-2">
                                            <span className="flex items-center gap-1">
                                                <span className="text-gray-500">👤</span> {action.owner}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="text-gray-500">📊</span> {action.dimension_reference}
                                            </span>
                                            <span className="col-span-2 flex items-start gap-1">
                                                <span className="text-emerald-500 mt-0.5">🎯</span>
                                                <span><strong className="text-gray-300">Metric:</strong> {action.success_metric}</span>
                                            </span>
                                            <span className="col-span-2 flex items-start gap-1">
                                                <span className="text-amber-500 mt-0.5">⚡</span>
                                                <span className="text-amber-400/80"><strong className="text-amber-500/80">Trigger:</strong> {action.why_now}</span>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
