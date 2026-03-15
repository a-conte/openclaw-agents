'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3">
      <AlertTriangle size={16} className="shrink-0 text-red-400" />
      <span className="flex-1 text-xs text-red-200">
        {message || 'Failed to load data. Showing stale results if available.'}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface-3 px-2 py-1 text-xs text-text-primary transition-colors hover:bg-surface-4"
        >
          <RotateCcw size={10} />
          Retry
        </button>
      )}
    </div>
  );
}
