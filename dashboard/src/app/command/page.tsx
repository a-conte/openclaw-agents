'use client';

import { useAgents } from '@/hooks/useAgents';
import { useTasks } from '@/hooks/useTasks';
import { MISSION_STATEMENT } from '@/lib/constants';
import { Diamond, Users, ListTodo, GitBranch, Radar, ArrowRight, Clock } from 'lucide-react';
import useSWR from 'swr';
import { Badge } from '@/components/shared/Badge';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CommandPage() {
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { data: briefingsData } = useSWR('/api/briefings', fetcher, { refreshInterval: 30000 });
  const { data: radarData } = useSWR('/api/radar', fetcher, { refreshInterval: 30000 });

  const activeAgents = agents.filter((a: any) => {
    const lastActivity = a.sessions?.recent?.[0]?.updatedAt;
    if (!lastActivity) return false;
    return Date.now() - lastActivity < 60 * 60 * 1000;
  }).length;

  const tasksInProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
  const pipelineItems = tasks.filter((t: any) => t.status !== 'done').length;
  const radarSignals = radarData?.items?.length || 0;
  const briefings = briefingsData?.briefings || [];

  const reversePrompts = [
    { id: '1', text: 'Automate weekly stock scarcity scans → reduce manual research by 80%', category: 'Automation' },
    { id: '2', text: 'Build a Plex content recommendation engine using viewing history', category: 'Project' },
    { id: '3', text: 'Deploy a GPU price tracker with alert thresholds', category: 'Monitoring' },
    { id: '4', text: 'Create an automated daily briefing summary with key metrics', category: 'Workflow' },
    { id: '5', text: 'Set up automated security scanning for all agent codebases', category: 'Security' },
  ];

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      {/* Mission Statement */}
      <div className="border border-border rounded-lg p-5 mb-6 bg-surface-1" style={{ borderLeftColor: '#FB5656', borderLeftWidth: 3 }}>
        <div className="flex items-center gap-2 mb-2">
          <Diamond size={14} className="text-accent" />
          <span className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium">Mission</span>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">{MISSION_STATEMENT}</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={16} />} label="Active Agents" value={`${activeAgents}/${agents.length}`} color="#FB5656" />
        <StatCard icon={<ListTodo size={16} />} label="In Progress" value={tasksInProgress.toString()} color="#4A9EFF" />
        <StatCard icon={<GitBranch size={16} />} label="Pipeline" value={pipelineItems.toString()} color="#ffd166" />
        <StatCard icon={<Radar size={16} />} label="Radar Signals" value={radarSignals.toString()} color="#8338ec" />
      </div>

      {/* Briefings Feed */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary font-[var(--font-heading)] uppercase tracking-[0.1em] mb-4">Briefings</h2>
        <div className="bg-surface-1 border border-border rounded-lg divide-y divide-border">
          {briefings.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary text-sm">No briefings scheduled</div>
          ) : (
            briefings.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors">
                <div className="flex items-center gap-3">
                  <Clock size={14} className="text-text-tertiary" />
                  <div>
                    <span className="text-sm text-text-primary">{b.name}</span>
                    <span className="text-xs text-text-tertiary ml-2">{b.time}</span>
                  </div>
                </div>
                <Badge
                  color={
                    b.status === 'delivered' ? '#FB5656' :
                    b.status === 'pending' ? '#ffd166' : '#555555'
                  }
                >
                  {b.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reverse Prompt Suggestions */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary font-[var(--font-heading)] uppercase tracking-[0.1em] mb-4">
          What OpenClaw Thinks You Should Do Next
        </h2>
        <div className="space-y-2">
          {reversePrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="flex items-center justify-between bg-surface-1 border border-border rounded-lg px-4 py-3 hover:border-accent/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Badge color="#4A9EFF">{prompt.category}</Badge>
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{prompt.text}</span>
              </div>
              <ArrowRight size={14} className="text-text-tertiary group-hover:text-accent transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-text-primary font-mono">{value}</div>
    </div>
  );
}
