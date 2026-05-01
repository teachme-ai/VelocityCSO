import React from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error: error.message };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`[ErrorBoundary] ${this.props.name || 'Component'} crashed:`, error.message, info.componentStack?.slice(0, 200));
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-center">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">{this.props.name || 'Framework'}</p>
                    <p className="text-sm text-zinc-600">Rendering unavailable for this audit</p>
                </div>
            );
        }
        return this.props.children;
    }
}
