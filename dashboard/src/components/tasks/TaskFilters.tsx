'use client';

import { Search, Plus } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { TASK_PRIORITIES, AGENT_EMOJIS } from '@/lib/constants';

interface TaskFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  agentFilter: string;
  onAgentFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  onNewTask: () => void;
}

const AGENT_IDS = ['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'];

export function TaskFilters({
  search, onSearchChange,
  agentFilter, onAgentFilterChange,
  priorityFilter, onPriorityFilterChange,
  onNewTask,
}: TaskFiltersProps) {
  const selectClass = 'bg-surface-3 border border-border rounded-md px-2.5 py-1.5 text-xs text-text-secondary focus:outline-none';

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search tasks..."
          className="bg-surface-3 border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-active w-[200px]"
        />
      </div>

      <select value={agentFilter} onChange={e => onAgentFilterChange(e.target.value)} className={selectClass}>
        <option value="">All agents</option>
        {AGENT_IDS.map(id => (
          <option key={id} value={id}>{AGENT_EMOJIS[id]} {id}</option>
        ))}
      </select>

      <select value={priorityFilter} onChange={e => onPriorityFilterChange(e.target.value)} className={selectClass}>
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <div className="ml-auto">
        <Button variant="primary" size="sm" onClick={onNewTask}>
          <Plus size={14} className="mr-1" /> New Task
        </Button>
      </div>
    </div>
  );
}
