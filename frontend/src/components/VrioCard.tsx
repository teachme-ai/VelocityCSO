import React from 'react';
import type { VrioAnalysisData } from '../types/frameworks';

interface Props {
    data?: VrioAnalysisData | null;
}

export const VrioCard: React.FC<Props> = ({ data }) => {
    if (!data) return null;

    const getColorClass = (score: number) => {
        if (score >= 70) return 'bg-green-500';
        if (score >= 40) return 'bg-blue-500';
        return 'bg-red-500';
    };

    const getVerdictBadge = (verdict: string) => {
        if (verdict.includes('Sustained')) return 'bg-green-600/20 text-green-400 border-green-500/50';
        if (verdict.includes('Temporary')) return 'bg-blue-600/20 text-blue-400 border-blue-500/50';
        if (verdict.includes('Parity')) return 'bg-amber-600/20 text-amber-400 border-amber-500/50';
        return 'bg-red-600/20 text-red-400 border-red-500/50';
    };

    const rows = [
        { label: 'Valuable', desc: 'Exploits opportunities / neutralises threats', data: data.valuable, letter: 'V' },
        { label: 'Rare', desc: 'Unique compared to competitors', data: data.rare, letter: 'R' },
        { label: 'Inimitable', desc: 'Costly or difficult to imitate', data: data.inimitable, letter: 'I' },
        { label: 'Organised', desc: 'Firm is structured to capture value', data: data.organised, letter: 'O' }
    ];

    return (
        <div className="bg-[#0a0a0f] border border-zinc-800 rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        VRIO Framework Analysis
                    </h3>
                    <p className="text-zinc-400 text-sm mt-1">
                        Evaluating the sustainability of: <strong className="text-zinc-200">{data.resource_evaluated}</strong>
                    </p>
                </div>

                <div className={`px-4 py-2 rounded-lg border flex flex-col items-center justify-center shrink-0 ${getVerdictBadge(data.verdict)}`}>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Strategic Verdict</span>
                    <span className="font-bold text-center">{data.verdict}</span>
                </div>
            </div>

            <div className="space-y-4">
                {rows.map((row, idx) => (
                    <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row gap-4">
                        <div className="md:w-1/3 shrink-0">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-8 h-8 rounded bg-zinc-800 text-zinc-300 font-black font-mono flex items-center justify-center shrink-0 border border-zinc-700 shadow-inner">
                                    {row.letter}
                                </div>
                                <div>
                                    <h4 className="font-bold text-zinc-100">{row.label}</h4>
                                    <p className="text-xs text-zinc-500">{row.desc}</p>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center gap-3 pl-11">
                                <div className="grow h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${getColorClass(row.data.score)}`} style={{ width: `${row.data.score}%` }}></div>
                                </div>
                                <span className="text-xs font-mono text-zinc-400 w-6 text-right">{row.data.score}</span>
                            </div>
                        </div>

                        <div className="md:w-2/3 border-t md:border-t-0 md:border-l border-zinc-800/50 pt-3 md:pt-0 md:pl-4 text-sm text-zinc-400 flex items-center leading-relaxed">
                            {row.data.evidence}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-5 text-sm text-zinc-400 bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-lg italic">
                "{data.verdict_rationale}"
            </div>
        </div>
    );
};
