import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface HeartbeatLog {
    id: string;
    timestamp: string;
    message: string;
    type: 'standard' | 'warning' | 'debug' | 'error';
}

interface HeartbeatTerminalProps {
    logs: HeartbeatLog[];
}

export const HeartbeatTerminal: React.FC<HeartbeatTerminalProps> = ({ logs }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getIcon = (type: HeartbeatLog['type']) => {
        switch (type) {
            case 'warning': return '⚠';
            case 'debug': return '[DEBUG]';
            case 'error': return '[ERROR]';
            default: return '◆';
        }
    };

    const getStyle = (type: HeartbeatLog['type']) => {
        switch (type) {
            case 'warning': return { color: '#fbbf24' };
            case 'debug': return { color: '#60a5fa', fontWeight: 'bold' };
            case 'error': return { color: '#f87171', fontWeight: 'bold' };
            default: return { color: '#00ff00' };
        }
    };

    return (
        <div style={{
            background: '#0a0a0f',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontSize: '11px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
            {/* Window Controls */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>live_telemetry.log</span>
            </div>

            {/* Terminal Body */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    padding: '16px',
                    overflowY: 'auto',
                    background: '#050507'
                }}
            >
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            style={{
                                marginBottom: '6px',
                                display: 'flex',
                                gap: '8px',
                                ...getStyle(log.type)
                            }}
                        >
                            <span style={{ opacity: 0.4, flexShrink: 0 }}>[{log.timestamp}]</span>
                            <span style={{ flexShrink: 0 }}>{getIcon(log.type)}</span>
                            <span>{log.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {logs.length === 0 && (
                    <div style={{ color: '#333', fontStyle: 'italic' }}>Waiting for connection...</div>
                )}
            </div>
        </div>
    );
};
