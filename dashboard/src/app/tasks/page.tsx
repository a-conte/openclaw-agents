'use client';

import { useState, useEffect } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { TaskModal } from '@/components/tasks/TaskModal';
import { LayoutGrid } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function TasksPage() {
  const { tasks, isLoading, createTask, updateTask, deleteTask } = useTasks();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [newTaskOpen, setNewTaskOpen] = useState(false);

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
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (agentFilter && t.agentId !== agentFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-text-primary">Tasks</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
          <kbd className="ml-3 text-[10px] text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">N</kbd>
          <span className="text-text-tertiary text-[10px] ml-1">new task</span>
        </p>
      </div>

      <div className="mb-4">
        <TaskFilters
          search={search}
          onSearchChange={setSearch}
          agentFilter={agentFilter}
          onAgentFilterChange={setAgentFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
          onNewTask={() => setNewTaskOpen(true)}
        />
      </div>

      {isLoading ? (
        <div className="flex gap-4 flex-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[300px] h-full bg-surface-2 rounded-lg animate-pulse" />
          ))}
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
