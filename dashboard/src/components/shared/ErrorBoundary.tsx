'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/8 p-6 text-center">
          <AlertTriangle size={24} className="text-red-400" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {this.props.name ? `${this.props.name} failed to render` : 'Something went wrong'}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-3 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-4"
          >
            <RotateCcw size={12} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
