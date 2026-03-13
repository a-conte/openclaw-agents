'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, Activity, Calendar, MessageSquare, Terminal, MessageCircle, Wrench, Circle, Pause, Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealth } from '@/hooks/useAgents';
import { useCron } from '@/hooks/useCron';
import { HeartbeatGrid } from '@/components/schedule/HeartbeatGrid';
import { CronCalendar } from '@/components/schedule/CronCalendar';
import { CronTimeline } from '@/components/schedule/CronTimeline';
import { SessionSidebar } from '@/components/sessions/SessionSidebar';
import { ChatView } from '@/components/sessions/ChatView';
import { AGENT_EMOJIS } from '@/lib/constants';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDashboardFilters } from '@/components/providers/DashboardProviders';
import { VirtualList } from '@/components/shared/VirtualList';
import useSWR from 'swr';
import type { Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TABS = [
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'sessions', label: 'Sessions', icon: MessageSquare },
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'feedback', label: 'Feedback', icon: MessageCircle },
  { id: 'config', label: 'Config', icon: Wrench },
] as const;

function SystemContent() {
  const { filters, setFocus } = useDashboardFilters();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'health');

  useEffect(() => {
    if (tabParam && TABS.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (filters.focus === 'system-check') {
      setActiveTab('health');
    }
  }, [filters.focus]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/system?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-0">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">System</h1>
        <p className="text-sm text-text-tertiary mt-1">Health, schedule, sessions, and configuration</p>
        {filters.focus === 'system-check' && (
          <button onClick={() => setFocus('')} className="mt-3 rounded-md border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs text-accent transition hover:bg-accent/15">
            Focused on system check - clear focus
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'text-accent border-accent'
                  : 'text-text-tertiary hover:text-text-secondary border-transparent'
              )}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'health' && <HealthTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'logs' && <LogsTab />}
        {activeTab === 'feedback' && <FeedbackTab />}
        {activeTab === 'config' && <ConfigTab />}
      </div>
    </div>
  );
}

export default function SystemPage() {
  return (
    <Suspense fallback={<div className="p-6 text-text-tertiary">Loading...</div>}>
      <SystemContent />
    </Suspense>
  );
}

function HealthTab() {
  const { health, isLoading } = useHealth();

  const components = [
    { name: 'Gateway', status: health?.ok ? 'online' : 'offline' },
    { name: 'Agent Orchestrator', status: health?.ok ? 'online' : 'offline' },
    { name: 'Task Queue', status: 'online' },
    { name: 'Memory Store', status: 'online' },
    { name: 'Cron Scheduler', status: 'online' },
    { name: 'Session Manager', status: health?.ok ? 'online' : 'offline' },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em]">System Components</h2>
      <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
        {components.map((comp) => (
          <div key={comp.name} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-primary">{comp.name}</span>
            <div className="flex items-center gap-2">
              <Circle
                size={8}
                className={cn(
                  'fill-current',
                  comp.status === 'online' ? 'text-status-online' : 'text-status-error'
                )}
              />
              <span className={cn(
                'text-xs',
                comp.status === 'online' ? 'text-status-online' : 'text-status-error'
              )}>
                {comp.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {health && (
        <div className="bg-surface-1 border border-border rounded-lg p-4">
          <h3 className="text-xs uppercase tracking-[0.1em] text-text-tertiary mb-3">Gateway Info</h3>
          <div className="space-y-2 text-xs text-text-secondary font-mono">
            <div>Agents: {health.agents?.length || 0}</div>
            <div>Sessions: {health.sessions?.count || 0}</div>
            <div>Heartbeat: {health.heartbeatSeconds}s</div>
            <div>Response: {health.durationMs}ms</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleTab() {
  const { cronJobs, heartbeats, isLoading } = useCron();
  const [view, setView] = useState<'calendar' | 'timeline'>('calendar');

  if (isLoading) {
    return <div className="space-y-4">
      <div className="h-[200px] bg-surface-2 rounded-lg animate-pulse" />
      <div className="h-[300px] bg-surface-2 rounded-lg animate-pulse" />
    </div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-end">
        <div className="flex items-center bg-surface-3 rounded-md p-0.5">
          <button
            onClick={() => setView('calendar')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
              view === 'calendar' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            <Calendar size={12} /> Calendar
          </button>
          <button
            onClick={() => setView('timeline')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
              view === 'timeline' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            <Terminal size={12} /> Timeline
          </button>
        </div>
      </div>
      <HeartbeatGrid heartbeats={heartbeats} />
      {view === 'calendar' ? <CronCalendar /> : <CronTimeline jobs={cronJobs} />}
    </div>
  );
}

function SessionsTab() {
  const AGENT_IDS = ['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'];
  const [agentId, setAgentId] = useState('main');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const { data: sessions, isLoading } = useSWR(
    `/api/agents/${agentId}/sessions`,
    fetcher,
    { refreshInterval: 15000 }
  );

  return (
    <div className="flex h-[calc(100vh-220px)] border border-border rounded-lg overflow-hidden">
      <div className="w-[260px] border-r border-border flex flex-col bg-surface-1">
        <div className="p-3 border-b border-border">
          <select
            value={agentId}
            onChange={e => { setAgentId(e.target.value); setSelectedKey(null); setSelectedSession(null); }}
            className="w-full bg-surface-3 border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary focus:outline-none"
          >
            {AGENT_IDS.map(id => (
              <option key={id} value={id}>{AGENT_EMOJIS[id]} {id}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-3 rounded-md animate-pulse" />
              ))}
            </div>
          ) : sessions ? (
            <SessionSidebar
              sessions={sessions}
              selectedSession={selectedKey}
              onSelect={(key: string, session: Session) => { setSelectedKey(key); setSelectedSession(session); }}
              agentId={agentId}
            />
          ) : null}
        </div>
      </div>
      <div className="flex-1 bg-surface-0">
        {selectedSession ? (
          <ChatView agentId={agentId} sessionId={selectedSession.sessionId} />
        ) : (
          <EmptyState
            icon={<MessageSquare size={32} />}
            title="Select a session"
            description="Choose a session from the sidebar"
          />
        )}
      </div>
    </div>
  );
}

interface LogLine {
  source: string;
  line: string;
}

function LogsTab() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch('/api/logs?lines=200')
      .then(r => r.json())
      .then(data => { setLogs(data.logs || []); setIsLoading(false); scrollToBottom(); })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isStreaming) { eventSourceRef.current?.close(); eventSourceRef.current = null; return; }
    const es = new EventSource('/api/logs?mode=stream');
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      try { const data = JSON.parse(event.data); setLogs(prev => [...prev.slice(-500), data]); scrollToBottom(); } catch {}
    };
    es.onerror = () => setIsStreaming(false);
    return () => es.close();
  }, [isStreaming]);

  function scrollToBottom() {
    requestAnimationFrame(() => { containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight }); });
  }

  const filteredLogs = filter ? logs.filter(l => l.line.toLowerCase().includes(filter.toLowerCase())) : logs;

  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      <div className="flex items-center justify-end gap-2 mb-3">
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter logs..."
          className="px-3 py-1.5 text-xs bg-surface-3 border border-border rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none w-48" />
        <button onClick={() => setLogs([])} className="p-1.5 rounded-md hover:bg-surface-3 text-text-secondary transition-colors" title="Clear">
          <Trash2 size={14} />
        </button>
        <button onClick={() => setIsStreaming(!isStreaming)}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors',
            isStreaming ? 'bg-status-online/10 text-status-online' : 'bg-surface-3 text-text-secondary hover:text-text-primary')}>
          {isStreaming ? <Pause size={12} /> : <Play size={12} />}
          {isStreaming ? 'Streaming' : 'Stream'}
        </button>
      </div>
      <div className="flex-1">
        {isLoading ? (
          <div className="flex h-full items-start rounded-lg border border-border bg-surface-0 p-4 font-mono text-xs text-text-tertiary">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-0 font-mono text-xs text-text-tertiary">
            <Terminal size={24} /><span>No log entries</span>
          </div>
        ) : (
          <VirtualList
            items={filteredLogs}
            itemHeight={24}
            height={560}
            overscan={20}
            className="rounded-lg border border-border bg-surface-0 font-mono text-xs"
            containerRef={containerRef}
            renderItem={(log, i) => (
              <div key={`${log.source}-${i}`} className="px-2">
                <div className={cn('flex gap-2 rounded px-2 py-0.5 hover:bg-white/5', log.source === 'stderr' && 'text-red-400')}>
                  <span className="w-8 shrink-0 select-none text-right text-text-tertiary">{i + 1}</span>
                  <span className={cn('w-12 shrink-0 select-none', log.source === 'stderr' ? 'text-red-500' : 'text-blue-500')}>[{log.source}]</span>
                  <span className="break-all text-gray-300">{log.line}</span>
                </div>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}

function FeedbackTab() {
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!feedback.trim()) return;
    setSubmitted(true);
    setFeedback('');
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em] mb-4">Feedback</h2>
      <p className="text-sm text-text-tertiary mb-4">Tell OpenClaw what to improve.</p>
      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        rows={6}
        className="w-full bg-surface-1 border border-border rounded-lg p-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/30 resize-none"
        placeholder="What should OpenClaw do differently?"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-accent/10 text-accent text-sm rounded-md hover:bg-accent/20 transition-colors"
        >
          Submit Feedback
        </button>
        {submitted && <span className="text-xs text-accent">Feedback received!</span>}
      </div>
    </div>
  );
}

function ConfigTab() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em] mb-4">Configuration</h2>
      <div className="bg-surface-1 border border-border rounded-lg p-8 text-center">
        <Wrench size={24} className="mx-auto text-text-tertiary mb-3" />
        <p className="text-sm text-text-tertiary">Configuration settings coming soon.</p>
      </div>
    </div>
  );
}
