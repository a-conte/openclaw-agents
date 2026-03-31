'use client';

import { Search, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { ACTIVE_AGENT_IDS, TASK_PRIORITIES, TASK_STATUSES, AGENT_EMOJIS, STATUS_LABELS } from '@/lib/constants';

interface TaskFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  agentFilter: string;
  onAgentFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  onClearFilters: () => void;
  onNewTask: () => void;
}

export function TaskFilters({
  search, onSearchChange,
  agentFilter, onAgentFilterChange,
  priorityFilter, onPriorityFilterChange,
  statusFilter, onStatusFilterChange,
  onClearFilters,
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
        {ACTIVE_AGENT_IDS.map(id => (
          <option key={id} value={id}>{AGENT_EMOJIS[id]} {id}</option>
        ))}
      </select>

      <select value={priorityFilter} onChange={e => onPriorityFilterChange(e.target.value)} className={selectClass}>
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)} className={selectClass}>
        <option value="">All stages</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
        ))}
      </select>

      <Button variant="ghost" size="sm" onClick={onClearFilters}>
        <RotateCcw size={13} className="mr-1" /> Clear
      </Button>

      <div className="ml-auto max-sm:ml-0">
        <Button variant="primary" size="sm" onClick={onNewTask}>
          <Plus size={14} className="mr-1" /> New Task
        </Button>
      </div>
    </div>
  );
}
