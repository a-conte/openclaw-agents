'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { FolderKanban, Plus, Users } from 'lucide-react';
import { AGENT_COLORS, AGENT_EMOJIS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTasks } from '@/hooks/useTasks';
import type { Project } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ProjectsPage() {
  const { data: projects, isLoading, mutate } = useSWR<Project[]>('/api/projects', fetcher);
  const { tasks } = useTasks();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    setNewName('');
    setNewDesc('');
    setShowNew(false);
    mutate();
  };

  return (
    <div className="p-6 max-w-5xl overflow-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Projects</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {(projects || []).length} project{(projects || []).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors"
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      {showNew && (
        <div className="bg-surface-1 border border-accent/30 rounded-lg p-4 mb-6">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Project name"
            className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none mb-2"
            autoFocus
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none resize-none mb-3"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 text-xs bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors">Create</button>
            <button onClick={() => setShowNew(false)} className="px-3 py-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[140px] bg-surface-2 border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={32} />}
          title="No projects yet"
          description="Create a project to organize your tasks"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => {
            const projectTasks = tasks.filter(t => t.projectId === project.id || t.labels.includes(project.name));
            const completed = projectTasks.filter(t => t.status === 'done').length;
            const total = projectTasks.length;
            const progress = total > 0 ? (completed / total) * 100 : 0;

            return (
              <div key={project.id} className="bg-surface-1 border border-border rounded-lg p-4 hover:border-border-hover transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-text-tertiary mt-1">{project.description}</p>
                    )}
                  </div>
                  <Badge color={
                    project.status === 'active' ? '#FB5656' :
                    project.status === 'completed' ? '#4A9EFF' : '#555'
                  }>
                    {project.status}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                    <span>{completed}/{total} tasks</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Assigned agents */}
                {project.agentIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-text-tertiary" />
                    <div className="flex gap-1">
                      {project.agentIds.map(id => (
                        <span key={id} className="text-xs" title={id}>
                          {AGENT_EMOJIS[id] || '🤖'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}