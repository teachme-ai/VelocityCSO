import React from 'react';
import type { AnsoffMatrixData } from '../types/frameworks';

interface Props {
    data?: AnsoffMatrixData | null;
}

export const AnsoffMatrix: React.FC<Props> = ({ data }) => {
    if (!data) return null;

    const getColor = (score: number) => {
        if (score >= 70) return 'bg-green-600/20 text-green-400 border-green-500/50';
        if (score >= 40) return 'bg-blue-600/20 text-blue-400 border-blue-500/50';
        return 'bg-red-600/20 text-red-400 border-red-500/50';
    };

    const isPrimary = (key: string) => data.primary_vector.toLowerCase().replace(' ', '_') === key;

    const renderCell = (key: keyof Omit<AnsoffMatrixData, 'primary_vector' | 'strategic_verdict'>, title: string, desc: string) => {
        const vector = data[key];
        const highlighted = isPrimary(key);

        return (
            <div className={`p-4 rounded-xl border ${highlighted ? 'border-violet-500 ring-1 ring-violet-500 bg-zinc-800/80' : 'border-zinc-800 bg-zinc-900'} flex flex-col`}>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h4 className={`font-bold ${highlighted ? 'text-violet-400' : 'text-zinc-100'}`}>{title}</h4>
                        <span className="text-xs text-zinc-500">{desc}</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${getColor(vector.score)}`}>
                        {vector.score}/100
                    </span>
                </div>

                <p className="text-sm text-zinc-400 mt-2 mb-3 flex-grow leading-relaxed">
                    {vector.rationale}
                </p>

                {vector.killer_move && (
                    <div className="mt-auto pt-3 border-t border-zinc-800/50">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Killer Move</span>
                        <p className="text-sm text-zinc-300">{vector.killer_move}</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[#0a0a0f] border border-zinc-800 rounded-xl p-6">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Ansoff Growth Matrix
                </h3>
                <p className="text-zinc-400 text-sm mt-1">Four vectors of strategic expansion evaluated for contextual viability.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCell('market_penetration', 'Market Penetration', 'Existing Product × Existing Market')}
                {renderCell('product_development', 'Product Development', 'New Product × Existing Market')}
                {renderCell('market_development', 'Market Development', 'Existing Product × New Market')}
                {renderCell('diversification', 'Diversification', 'New Product × New Market')}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-violet-900/10 border border-violet-500/20">
                <h4 className="text-violet-400 font-bold mb-1 uppercase tracking-wider text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Strategic Verdict
                </h4>
                <p className="text-zinc-300 md:text-lg">{data.strategic_verdict}</p>
            </div>
        </div>
    );
};
