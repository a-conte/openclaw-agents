'use client';

import { useState, useEffect } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { InlineError } from '@/components/shared/InlineError';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { TaskModal } from '@/components/tasks/TaskModal';
import { useDashboardFilters } from '@/components/providers/DashboardProviders';
import { PIPELINE_STAGES, AGENT_COLORS, AGENT_EMOJIS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import { cn } from '@/lib/utils';
import { LayoutGrid, List } from 'lucide-react';

export default function PipelinePage() {
  const { filters, setSearch, setAgentId } = useDashboardFilters();
  const { tasks, isLoading, error, createTask, updateTask, deleteTask } = useTasks();
  const [priorityFilter, setPriorityFilter] = useState('');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [view, setView] = useState<'funnel' | 'board'>('funnel');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        setNewTaskOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filteredTasks = tasks.filter(t => {
    const needle = filters.search.trim().toLowerCase();
    if (filters.focus === 'pipeline-hotspots' && !['in_progress', 'review'].includes(t.status) && !['urgent', 'high'].includes(t.priority)) return false;
    if (needle && ![t.title, t.description, t.labels.join(' ')].join(' ').toLowerCase().includes(needle)) return false;
    if (filters.agentId && t.agentId !== filters.agentId) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  const stageCounts = Object.entries(PIPELINE_STAGES).map(([status, stage]) => ({
    status,
    ...stage,
    count: filteredTasks.filter(t => t.status === status).length,
  }));
  const maxCount = Math.max(...stageCounts.map(s => s.count), 1);

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Pipeline</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
            <kbd className="ml-3 text-[10px] text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">N</kbd>
            <span className="text-text-tertiary text-[10px] ml-1">new task</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-3 rounded-md p-0.5">
            <button
              onClick={() => setView('funnel')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
                view === 'funnel' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <List size={12} /> Funnel
            </button>
            <button
              onClick={() => setView('board')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
                view === 'board' ? 'bg-surface-4 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              <LayoutGrid size={12} /> Board
            </button>
          </div>
        </div>
      </div>

      {error && <InlineError message="Failed to load tasks." />}

      <div className="mb-4">
        <TaskFilters
          search={filters.search}
          onSearchChange={setSearch}
          agentFilter={filters.agentId}
          onAgentFilterChange={setAgentId}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          onNewTask={() => setNewTaskOpen(true)}
        />
      </div>

      {isLoading ? (
        <div className="flex-1 bg-surface-2 rounded-lg animate-pulse" />
      ) : view === 'funnel' ? (
        <div className="space-y-6 flex-1 overflow-auto">
          {/* Funnel Chart */}
          <div className="bg-surface-1 border border-border rounded-lg p-5">
            <h2 className="text-xs uppercase tracking-[0.1em] text-text-tertiary font-medium mb-4">Pipeline Stages</h2>
            <div className="space-y-3">
              {stageCounts.map((stage) => (
                <div key={stage.status} className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary w-16 text-right">{stage.label}</span>
                  <div className="flex-1 bg-surface-3 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-3 transition-all duration-500"
                      style={{
                        width: `${Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0)}%`,
                        backgroundColor: stage.color,
                        opacity: 0.8,
                      }}
                    >
                      {stage.count > 0 && (
                        <span className="text-xs font-mono font-medium text-surface-0">{stage.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Task List Table */}
          <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-tertiary text-xs uppercase tracking-wider border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium">Task</th>
                  <th className="text-left px-4 py-2.5 font-medium">Agent</th>
                  <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                  <th className="text-left px-4 py-2.5 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-text-tertiary">No tasks match the current filters{filters.focus ? ` (${filters.focus})` : ''}</td></tr>
                ) : (
                  filteredTasks.map((task) => {
                    const stage = PIPELINE_STAGES[task.status] || { label: task.status, color: '#555' };
                    return (
                      <tr key={task.id} className="border-t border-border hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-2.5 text-text-primary">{task.title}</td>
                        <td className="px-4 py-2.5">
                          {task.agentId ? (
                            <span className="flex items-center gap-1.5 text-text-secondary text-xs">
                              <span>{AGENT_EMOJIS[task.agentId] || '🤖'}</span>
                              {task.agentId}
                            </span>
                          ) : (
                            <span className="text-text-tertiary text-xs">unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge color={
                            task.priority === 'urgent' ? '#e94560' :
                            task.priority === 'high' ? '#ffd166' :
                            task.priority === 'medium' ? '#4A9EFF' : '#555'
                          }>
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge color={stage.color}>{stage.label}</Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <TaskBoard
            tasks={filteredTasks}
            onUpdate={updateTask}
            onCreate={createTask}
            onDelete={deleteTask}
          />
        </div>
      )}

      <TaskModal
        task={null}
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onSave={updateTask}
        onCreate={createTask}
        onDelete={deleteTask}
      />
    </div>
  );
}
