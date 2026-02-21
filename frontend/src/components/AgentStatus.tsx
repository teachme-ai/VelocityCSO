/**
 * AgentStatus — Live Terminal Feed
 *
 * Renders SSE events as a scrolling terminal-style panel during analysis.
 * Each event type maps to a labelled, timestamped line item.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type StatusEvent = {
    type: string;
    phase?: string;
    summary?: string;
    gap?: string;
    cost_usd?: number;
    [key: string]: unknown;
};

type LineItem = {
    id: string;
    icon: string;
    color: string;
    text: string;
    time: string;
};

function timestamp(): string {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function eventToLine(event: StatusEvent): LineItem | null {
    const id = `${Date.now()}-${Math.random()}`;
    const time = timestamp();

    switch (event.type) {
        case 'SESSION_INIT':
            return { id, icon: '◆', color: 'text-violet-400', text: 'Session initialized', time };
        case 'DISCOVERY_START':
            return { id, icon: '▶', color: 'text-blue-400', text: 'Discovery Agent — scanning 24-month public signals', time };
        case 'DISCOVERY_COMPLETE':
            return { id, icon: '✓', color: 'text-emerald-400', text: event.summary as string || 'Discovery scan complete', time };
        case 'NEED_CLARIFICATION':
            return { id, icon: '⚠', color: 'text-amber-400', text: `Gap detected — awaiting clarification`, time };
        case 'ANALYSIS_START':
            return {
                id, icon: '⚡', color: 'text-violet-300',
                text: event.phase === 'synthesizing'
                    ? 'CSO delegating to 5 domain specialists + Strategic Critic'
                    : `Analysis phase: ${event.phase}`,
                time
            };
        case 'REPORT_COMPLETE':
            return {
                id, icon: '◉', color: 'text-emerald-300',
                text: event.cost_usd ? `Report generated — est. cost $${Number(event.cost_usd).toFixed(5)}` : 'Report generated',
                time
            };
        case 'ERROR':
            return { id, icon: '✗', color: 'text-red-400', text: `Error: ${event.message || 'Unknown error'}`, time };
        default:
            return null;
    }
}

interface AgentStatusProps {
    events: StatusEvent[];
    visible: boolean;
}

export function AgentStatus({ events, visible }: AgentStatusProps) {
    const bottomRef = useRef<HTMLDivElement>(null);
    const lines: LineItem[] = events.map(eventToLine).filter(Boolean) as LineItem[];

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines.length]);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-2xl overflow-hidden"
                >
                    <div
                        className="rounded-xl border border-white/8 overflow-y-auto"
                        style={{
                            background: 'rgba(5, 8, 20, 0.85)',
                            backdropFilter: 'blur(12px)',
                            maxHeight: '220px',
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                        }}
                    >
                        {/* Terminal header */}
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                            <div className="w-2 h-2 rounded-full bg-red-500/60" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                            <div className="w-2 h-2 rounded-full bg-green-500/60" />
                            <span className="text-[10px] text-gray-600 ml-2 tracking-widest uppercase">Agent Heartbeat</span>
                        </div>

                        {/* Log lines */}
                        <div className="p-4 space-y-1.5">
                            {lines.length === 0 ? (
                                <p className="text-xs text-gray-600">Initializing...</p>
                            ) : (
                                lines.map((line) => (
                                    <motion.div
                                        key={line.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-start gap-2 text-xs"
                                    >
                                        <span className="text-gray-600 flex-shrink-0 w-16">{line.time}</span>
                                        <span className={`flex-shrink-0 ${line.color}`}>{line.icon}</span>
                                        <span className="text-gray-300">{line.text}</span>
                                    </motion.div>
                                ))
                            )}
                            {/* Blinking cursor */}
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-600 w-16">{timestamp()}</span>
                                <span className="text-violet-400 animate-pulse">▌</span>
                            </div>
                            <div ref={bottomRef} />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
