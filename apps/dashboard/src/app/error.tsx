'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/8 p-8 text-center">
        <AlertTriangle size={32} className="text-red-400" />
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {error.message || 'An unexpected error occurred while rendering this page.'}
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-3 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-4"
        >
          <RotateCcw size={14} />
          Try again
        </button>
      </div>
    </div>
  );
}
