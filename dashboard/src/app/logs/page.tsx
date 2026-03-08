'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Pause, Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogLine {
  source: string;
  line: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial snapshot
  useEffect(() => {
    fetch('/api/logs?lines=200')
      .then(r => r.json())
      .then(data => {
        setLogs(data.logs || []);
        setIsLoading(false);
        scrollToBottom();
      })
      .catch(() => setIsLoading(false));
  }, []);

  // SSE streaming
  useEffect(() => {
    if (!isStreaming) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const es = new EventSource('/api/logs?mode=stream');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs(prev => [...prev.slice(-500), data]);
        scrollToBottom();
      } catch {}
    };

    es.onerror = () => {
      setIsStreaming(false);
    };

    return () => es.close();
  }, [isStreaming]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
    });
  }

  const filteredLogs = filter
    ? logs.filter(l => l.line.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Logs</h1>
          <p className="text-sm text-text-tertiary mt-1">Gateway log output</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter logs..."
            className="px-3 py-1.5 text-xs bg-surface-3 border border-border rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent w-48"
          />
          <button
            onClick={() => setLogs([])}
            className="p-1.5 rounded-md hover:bg-surface-3 text-text-secondary transition-colors"
            title="Clear"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors',
              isStreaming
                ? 'bg-status-online/10 text-status-online'
                : 'bg-surface-3 text-text-secondary hover:text-text-primary'
            )}
          >
            {isStreaming ? <Pause size={12} /> : <Play size={12} />}
            {isStreaming ? 'Streaming' : 'Stream'}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 bg-[#0d1117] border border-border rounded-lg overflow-auto font-mono text-xs"
      >
        {isLoading ? (
          <div className="p-4 text-text-tertiary">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-2">
            <Terminal size={24} />
            <span>No log entries</span>
          </div>
        ) : (
          <div className="p-2">
            {filteredLogs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  'py-0.5 px-2 hover:bg-white/5 rounded flex gap-2',
                  log.source === 'stderr' && 'text-red-400'
                )}
              >
                <span className="text-text-tertiary select-none shrink-0 w-8 text-right">
                  {i + 1}
                </span>
                <span className={cn(
                  'select-none shrink-0 w-12',
                  log.source === 'stderr' ? 'text-red-500' : 'text-blue-500'
                )}>
                  [{log.source}]
                </span>
                <span className="text-gray-300 break-all">{log.line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
