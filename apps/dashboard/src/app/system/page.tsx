'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Settings, Activity, Calendar, MessageSquare, Terminal, MessageCircle, Wrench, Circle, Pause, Play, Trash2, Inbox, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHealth } from '@/hooks/useAgents';
import { useCron } from '@/hooks/useCron';
import { HeartbeatGrid } from '@/components/schedule/HeartbeatGrid';
import { CronCalendar } from '@/components/schedule/CronCalendar';
import { CronTimeline } from '@/components/schedule/CronTimeline';
import { SessionSidebar } from '@/components/sessions/SessionSidebar';
import { ChatView } from '@/components/sessions/ChatView';
import { ACTIVE_AGENT_IDS, ALL_AGENT_IDS, AGENT_EMOJIS, AGENT_ROLES, AGENT_COLORS, PRIORITY_COLORS } from '@/lib/constants';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { InlineError } from '@/components/shared/InlineError';
import { useDashboardFilters } from '@/components/providers/DashboardProviders';
import { VirtualList } from '@/components/shared/VirtualList';
import { usePollingInterval } from '@/hooks/usePageVisibility';
import useSWR from 'swr';
import type { Session } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TABS = [
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
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
        {activeTab === 'inbox' && <InboxTab />}
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
    <ErrorBoundary name="System">
      <Suspense fallback={<div className="p-6 text-text-tertiary">Loading...</div>}>
        <SystemContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function HealthTab() {
  const { health, isLoading, error: healthError } = useHealth();
  const heartbeatInterval = usePollingInterval(15000);
  const { data: heartbeats, error: heartbeatError, mutate: mutateHeartbeats } = useSWR('/api/metrics/heartbeats', fetcher, { refreshInterval: heartbeatInterval });

  const components = [
    { name: 'Gateway', status: health?.ok ? 'online' : 'offline' },
    { name: 'Agent Orchestrator', status: health?.ok ? 'online' : 'offline' },
    { name: 'Task Queue', status: 'online' },
    { name: 'Memory Store', status: 'online' },
    { name: 'Cron Scheduler', status: 'online' },
    { name: 'Session Manager', status: health?.ok ? 'online' : 'offline' },
  ];

  function getHeartbeatAge(timestamp: string | null): string {
    if (!timestamp) return 'never';
    const age = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(age / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function getHeartbeatStatus(timestamp: string | null): 'online' | 'warning' | 'offline' {
    if (!timestamp) return 'offline';
    const age = Date.now() - new Date(timestamp).getTime();
    if (age < 45 * 60 * 1000) return 'online'; // 1.5x 30min interval
    if (age < 2 * 60 * 60 * 1000) return 'warning';
    return 'offline';
  }

  return (
    <div className="max-w-3xl space-y-6">
      {(healthError || heartbeatError) && (
        <InlineError message="Failed to load health data." onRetry={() => mutateHeartbeats()} />
      )}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em]">System Components</h2>
        <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
          {components.map((comp) => (
            <div key={comp.name} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-text-primary">{comp.name}</span>
              <div className="flex items-center gap-2">
                <Circle size={8} className={cn('fill-current', comp.status === 'online' ? 'text-status-online' : 'text-status-error')} />
                <span className={cn('text-xs', comp.status === 'online' ? 'text-status-online' : 'text-status-error')}>{comp.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {Array.isArray(heartbeats?.agents) && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em]">Agent Heartbeats</h2>
          <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
            {heartbeats.agents.map((agent: { agentId: string; lastHeartbeat: string | null; lastDurationMs: number | null; heartbeatCount24h: number; avgDurationMs: number | null; inboxCount: number }) => {
              const status = getHeartbeatStatus(agent.lastHeartbeat);
              return (
                <div key={agent.agentId} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-base">{AGENT_EMOJIS[agent.agentId]}</span>
                    <div>
                      <span className="text-sm text-text-primary font-medium">{agent.agentId}</span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-text-tertiary">{agent.heartbeatCount24h} beats/24h</span>
                        {agent.avgDurationMs != null && (
                          <span className="text-xs text-text-tertiary">avg {(agent.avgDurationMs / 1000).toFixed(1)}s</span>
                        )}
                        {agent.inboxCount > 0 && (
                          <span className="text-xs text-accent">{agent.inboxCount} in inbox</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {agent.lastDurationMs != null && agent.lastDurationMs > 0 && (
                      <span className="text-xs text-text-tertiary font-mono">{(agent.lastDurationMs / 1000).toFixed(1)}s</span>
                    )}
                    <div className="flex items-center gap-2">
                      <Circle size={8} className={cn('fill-current', status === 'online' ? 'text-status-online' : status === 'warning' ? 'text-yellow-500' : 'text-status-error')} />
                      <span className={cn('text-xs', status === 'online' ? 'text-status-online' : status === 'warning' ? 'text-yellow-500' : 'text-status-error')}>
                        {getHeartbeatAge(agent.lastHeartbeat)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-text-tertiary">
            Total heartbeats logged: {heartbeats.totalHeartbeats}
          </div>
        </div>
      )}

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
  const [agentId, setAgentId] = useState('main');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const sessionsInterval = usePollingInterval(15000);
  const { data: sessions, isLoading } = useSWR(
    `/api/agents/${agentId}/sessions`,
    fetcher,
    { refreshInterval: sessionsInterval }
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
            {ACTIVE_AGENT_IDS.map(id => (
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
  const configInterval = usePollingInterval(30000);
  const { data: config, isLoading } = useSWR('/api/config', fetcher, { refreshInterval: configInterval });

  if (isLoading || !config) {
    return <div className="max-w-3xl space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-surface-2 rounded-lg animate-pulse" />)}
    </div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em]">Agent Configuration</h2>
        <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
          {config.agents.map((agent: { agentId: string; role: string; active: boolean; hasHeartbeat: boolean; hasTools: boolean; hasSoul: boolean; hasMemory: boolean; tools: string[]; model: string | null; heartbeatInterval: number | null }) => (
            <div key={agent.agentId} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{AGENT_EMOJIS[agent.agentId]}</span>
                  <span className="text-sm font-medium text-text-primary">{agent.agentId}</span>
                  {!agent.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500">disabled</span>}
                </div>
                <span className="text-xs text-text-tertiary font-mono">{agent.model || 'default'}</span>
              </div>
              <p className="text-xs text-text-tertiary mb-2">{agent.role}</p>
              <div className="flex items-center gap-4 text-xs">
                <span className={agent.hasHeartbeat ? 'text-status-online' : 'text-status-error'}>
                  {agent.hasHeartbeat ? <CheckCircle size={11} className="inline mr-1" /> : <AlertTriangle size={11} className="inline mr-1" />}
                  HEARTBEAT
                </span>
                <span className={agent.hasTools ? 'text-status-online' : 'text-text-tertiary'}>
                  {agent.hasTools ? <CheckCircle size={11} className="inline mr-1" /> : <Circle size={11} className="inline mr-1" />}
                  TOOLS
                </span>
                <span className={agent.hasSoul ? 'text-status-online' : 'text-text-tertiary'}>
                  {agent.hasSoul ? <CheckCircle size={11} className="inline mr-1" /> : <Circle size={11} className="inline mr-1" />}
                  SOUL
                </span>
                <span className={agent.hasMemory ? 'text-status-online' : 'text-text-tertiary'}>
                  {agent.hasMemory ? <CheckCircle size={11} className="inline mr-1" /> : <Circle size={11} className="inline mr-1" />}
                  MEMORY
                </span>
                {agent.heartbeatInterval && (
                  <span className="text-text-tertiary ml-auto">
                    <Clock size={11} className="inline mr-1" />
                    {agent.heartbeatInterval / 60}min interval
                  </span>
                )}
              </div>
              {agent.tools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.tools.map(tool => (
                    <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary">{tool}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-1 border border-border rounded-lg p-4">
        <h3 className="text-xs uppercase tracking-[0.1em] text-text-tertiary mb-3">System Overview</h3>
        <div className="flex items-center gap-6 text-xs text-text-secondary">
          <span>{config.agents.length} agents configured</span>
          <span>{config.agents.filter((a: { active: boolean }) => a.active).length} active</span>
          <span>{config.workflows} workflows</span>
          <span>{config.pipelines} pipelines</span>
        </div>
      </div>
    </div>
  );
}

function InboxTab() {
  const inboxInterval = usePollingInterval(10000);
  const { data: inbox, isLoading } = useSWR('/api/inbox', fetcher, { refreshInterval: inboxInterval });

  if (isLoading || !inbox) {
    return <div className="max-w-3xl space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-surface-2 rounded-lg animate-pulse" />)}
    </div>;
  }

  if (inbox.totalCount === 0) {
    return (
      <div className="max-w-3xl">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em] mb-4">Inter-Agent Inbox</h2>
        <EmptyState
          icon={<Inbox size={32} />}
          title="All inboxes empty"
          description="No inter-agent messages currently pending"
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-[0.1em]">Inter-Agent Inbox</h2>
        <span className="text-xs text-text-tertiary">{inbox.totalCount} message{inbox.totalCount !== 1 ? 's' : ''}</span>
      </div>

      {(ALL_AGENT_IDS as readonly string[]).map(agentId => {
        const messages = inbox.byAgent[agentId] || [];
        if (messages.length === 0) return null;

        return (
          <div key={agentId} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{AGENT_EMOJIS[agentId]}</span>
              <span className="text-sm font-medium text-text-primary">{agentId}</span>
              <span className="text-xs text-text-tertiary">({messages.length})</span>
            </div>
            <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
              {messages.map((msg: { filename: string; from: string; subject: string; priority: string; status: string; timestamp: string; body: string; workflow?: string; pipeline?: string }) => (
                <div key={msg.filename} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">{msg.subject}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${PRIORITY_COLORS[msg.priority] || '#555'}20`, color: PRIORITY_COLORS[msg.priority] || '#555' }}>
                        {msg.priority}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', msg.status === 'unread' ? 'bg-accent/10 text-accent' : 'bg-surface-3 text-text-tertiary')}>
                        {msg.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-text-tertiary">{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span>from: {msg.from}</span>
                    {msg.workflow && <span>workflow: {msg.workflow}</span>}
                    {msg.pipeline && <span>pipeline: {msg.pipeline}</span>}
                  </div>
                  {msg.body && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">{msg.body}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
