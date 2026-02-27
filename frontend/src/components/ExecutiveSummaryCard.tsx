import { motion } from 'framer-motion';
import { Award, Zap, Shield, TrendingUp } from 'lucide-react';

interface ExecutiveSummaryProps {
    orgName: string;
    moatRationale: string;
    dimensions: Record<string, number>;
}

export const ExecutiveSummaryCard = ({ orgName, moatRationale, dimensions }: ExecutiveSummaryProps) => {
    // Get top 3 dimensions
    const developingMoats = Object.entries(dimensions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, score]) => ({ name, score }));

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6 p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl backdrop-blur-xl h-full shadow-2xl"
        >
            <div>
                <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                    <Award className="w-3 h-3 text-purple-400" />
                    Strategic Verdict
                </h2>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
                    {orgName}
                </h1>
            </div>

            <div className="space-y-4">
                <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                    <p className="text-zinc-300 text-sm leading-relaxed italic">
                        "{moatRationale}"
                    </p>
                </div>

                <div className="space-y-3">
                    <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.15em] mb-4">
                        Core Moats Identified
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {developingMoats.map((moat, idx) => (
                            <div
                                key={moat.name}
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-purple-500/30 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:bg-purple-500/10 transition-colors">
                                        {idx === 0 ? <Shield className="w-4 h-4 text-purple-400" /> :
                                            idx === 1 ? <Zap className="w-4 h-4 text-amber-400" /> :
                                                <TrendingUp className="w-4 h-4 text-emerald-400" />}
                                    </div>
                                    <span className="text-zinc-200 font-medium text-sm">{moat.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${moat.score}%` }}
                                            className="h-full bg-gradient-to-r from-zinc-700 to-purple-500"
                                        />
                                    </div>
                                    <span className="text-purple-400 font-mono text-sm w-8 text-right font-bold">{moat.score}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-zinc-800/50">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">
                    Asymmetric Advantage Analysis · CSO v2.5
                </p>
            </div>
        </motion.div>
    );
};
