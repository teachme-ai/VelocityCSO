import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import axios from 'axios';
import { AgentOrbs } from './AgentOrbs';
import { DiagnosticScorecard } from './DiagnosticScorecard';
import { ShieldAlert, ChevronRight, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/analyze';

type Status = 'idle' | 'market' | 'finance' | 'cso';
type ReportData = {
    analysis_markdown?: string;
    dimensions?: Record<string, number>;
    confidence_score?: number;
};

function StarField() {
    return (
        <Canvas camera={{ position: [0, 0, 1] }} style={{ position: 'absolute', inset: 0 }}>
            <Stars radius={80} depth={60} count={6000} factor={4} saturation={0} fade speed={0.5} />
        </Canvas>
    );
}

export function HeroSection() {
    const [context, setContext] = useState('');
    const [stressTest, setStressTest] = useState(false);
    const [status, setStatus] = useState<Status>('idle');
    const [result, setResult] = useState<ReportData | null>(null);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!context.trim()) return;
        setResult(null); setError('');
        setStatus('market');
        setTimeout(() => setStatus('finance'), 2500);
        setTimeout(() => setStatus('cso'), 5000);

        try {
            const response = await axios.post(API_URL, { business_context: context, stress_test: stressTest });
            let parsed: ReportData;
            try {
                parsed = typeof response.data.report === 'string'
                    ? JSON.parse(response.data.report.replace(/```json/g, '').replace(/```/g, '').trim())
                    : response.data.report;
            } catch {
                parsed = { analysis_markdown: response.data.report, dimensions: {} };
            }
            setResult(parsed);
            setStatus('idle');
        } catch {
            setError('Analysis failed. Please try again.');
            setStatus('idle');
        }
    };

    return (
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
            <div className="absolute inset-0 z-0">
                <StarField />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />
                <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 70% 80%, rgba(5,150,105,0.1) 0%, transparent 60%)' }} />
            </div>

            <div className="relative z-10 text-center w-full max-w-4xl mx-auto flex flex-col items-center gap-10">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-sm font-medium tracking-[0.3em] uppercase text-violet-300" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Velocity CSO</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                </motion.div>

                <div className="space-y-2">
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="text-6xl md:text-8xl font-bold leading-[1.05] tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        <span className="text-gradient-main">Strategy at the</span><br />
                        <span className="text-white">Speed of Thought.</span>
                    </motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}
                        className="text-lg text-gray-400 max-w-xl mx-auto mt-6 leading-relaxed">
                        A self-correcting AI strategy engine that diagnoses your business across 15 dimensions — in minutes, not months.
                    </motion.p>
                </div>

                <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-2xl">
                    <form onSubmit={handleAudit} className="glass-card glow-purple p-6 flex flex-col gap-4">
                        <textarea
                            ref={inputRef}
                            className="w-full h-36 bg-transparent border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none text-sm leading-relaxed"
                            placeholder="Describe your business in plain language — your model, market, constraints, and ambition. The more specific, the sharper the intelligence..."
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            disabled={status !== 'idle'}
                        />
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-10 h-5 rounded-full flex items-center transition-all duration-300 px-0.5 ${stressTest ? 'bg-violet-600' : 'bg-white/10'}`} onClick={() => setStressTest(!stressTest)}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${stressTest ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                                <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">Conservative Stress Test</span>
                            </label>
                            <button type="submit" disabled={status !== 'idle' || !context.trim()} className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                Audit My Business <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </motion.div>

                {status !== 'idle' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <AgentOrbs status={status} />
                    </motion.div>
                )}
                {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>

            <AnimatePresence>
                {result && (
                    <motion.div initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 80 }}
                        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                        className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-0">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResult(null)} />
                        <div className="relative glass-card w-full max-w-5xl flex flex-col max-h-[85vh] overflow-hidden rounded-b-none">
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Strategy Intelligence Report</h2>
                                <button onClick={() => setResult(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-8">
                                {result.dimensions && Object.keys(result.dimensions).length > 0 && (
                                    <DiagnosticScorecard dimensions={result.dimensions} onAreaClick={() => { }} />
                                )}
                                {result.confidence_score && result.confidence_score < 70 && (
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-4">
                                        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-amber-300 font-semibold text-sm">Strategic Blindspot Detected</h4>
                                            <p className="text-amber-200/70 text-xs mt-1">Confidence: {result.confidence_score}/100. Critic flagged contradictions or insufficient supporting data.</p>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 tracking-wide uppercase">Executive Synthesis</h3>
                                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                                        {result.analysis_markdown || JSON.stringify(result, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
