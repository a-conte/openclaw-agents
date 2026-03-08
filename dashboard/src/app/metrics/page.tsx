'use client';

import useSWR from 'swr';
import { BarChart3, Inbox, MessageSquare, Clock } from 'lucide-react';
import { AGENT_EMOJIS, AGENT_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AgentMetrics {
  agentId: string;
  sessionCount: number;
  lastActivity: number | null;
  totalMessages: number;
  inboxCount: number;
}

export default function MetricsPage() {
  const { data, isLoading } = useSWR('/api/metrics', fetcher, { refreshInterval: 30000 });

  const agents: AgentMetrics[] = data?.agents || [];
  const totalSessions = agents.reduce((sum, a) => sum + a.sessionCount, 0);
  const totalMessages = agents.reduce((sum, a) => sum + a.totalMessages, 0);
  const totalInbox = agents.reduce((sum, a) => sum + a.inboxCount, 0);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary">Metrics</h1>
        <p className="text-sm text-text-tertiary mt-1">Agent activity and system health</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={<MessageSquare size={16} />}
          label="Total Messages"
          value={isLoading ? '—' : totalMessages.toLocaleString()}
          sublabel="across recent sessions"
        />
        <SummaryCard
          icon={<BarChart3 size={16} />}
          label="Total Sessions"
          value={isLoading ? '—' : totalSessions.toLocaleString()}
          sublabel="all agents"
        />
        <SummaryCard
          icon={<Inbox size={16} />}
          label="Pending Messages"
          value={isLoading ? '—' : totalInbox.toString()}
          sublabel="in agent inboxes"
        />
        <SummaryCard
          icon={<Clock size={16} />}
          label="Dashboard Uptime"
          value={isLoading ? '—' : formatUptime(data?.system?.uptime)}
          sublabel="current process"
        />
      </div>

      {/* Per-Agent Table */}
      <div className="bg-surface-2 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Agent Breakdown</h2>
        </div>

        {isLoading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-10 bg-surface-3 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-tertiary text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">Agent</th>
                <th className="text-right px-4 py-2 font-medium">Sessions</th>
                <th className="text-right px-4 py-2 font-medium">Messages</th>
                <th className="text-right px-4 py-2 font-medium">Inbox</th>
                <th className="text-right px-4 py-2 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.agentId} className="border-t border-border hover:bg-surface-3 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{AGENT_EMOJIS[agent.agentId] || '🤖'}</span>
                      <span className="text-text-primary font-medium">{agent.agentId}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-2.5 text-text-secondary">{agent.sessionCount}</td>
                  <td className="text-right px-4 py-2.5 text-text-secondary">{agent.totalMessages}</td>
                  <td className="text-right px-4 py-2.5">
                    <span className={cn(
                      agent.inboxCount > 0 ? 'text-amber-400' : 'text-text-tertiary'
                    )}>
                      {agent.inboxCount}
                    </span>
                  </td>
                  <td className="text-right px-4 py-2.5 text-text-tertiary text-xs">
                    {agent.lastActivity ? relativeTime(agent.lastActivity) : 'never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, sublabel }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="bg-surface-2 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-text-tertiary mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      <div className="text-xs text-text-tertiary mt-1">{sublabel}</div>
    </div>
  );
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
