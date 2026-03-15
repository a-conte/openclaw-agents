'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@/components/shared/Dialog';
import { Button } from '@/components/shared/Button';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { ACTIVE_AGENT_IDS, TASK_STATUSES, TASK_PRIORITIES, AGENT_EMOJIS } from '@/lib/constants';
import { Trash2, Eye, Edit3 } from 'lucide-react';
import type { Task } from '@/lib/types';

interface TaskModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Task>) => void;
  onCreate: (task: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskModal({ task, open, onClose, onSave, onCreate, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Task['status']>('backlog');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [agentId, setAgentId] = useState<string>('');
  const [labels, setLabels] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setAgentId(task.agentId || '');
      setLabels(task.labels.join(', '));
      setDueDate(task.dueDate || '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('backlog');
      setPriority('medium');
      setAgentId('');
      setLabels('');
      setDueDate('');
    }
    setPreviewMode(false);
  }, [task, open]);

  const handleSave = () => {
    const data = {
      title,
      description,
      status,
      priority,
      agentId: agentId || undefined,
      labels: labels.split(',').map(l => l.trim()).filter(Boolean),
      dueDate: dueDate || undefined,
    };
    if (task) {
      onSave(task.id, data);
    } else {
      onCreate(data);
    }
    onClose();
  };

  const selectClass = 'bg-surface-3 border border-border rounded-md px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-border-active';
  const inputClass = 'w-full bg-surface-3 border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-active';

  return (
    <Dialog open={open} onClose={onClose} title={task ? 'Edit Task' : 'New Task'} className="max-w-xl">
      <div className="space-y-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          className={inputClass}
          autoFocus
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-text-tertiary">Description (Markdown)</label>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
            >
              {previewMode ? <Edit3 size={11} /> : <Eye size={11} />}
              {previewMode ? 'Edit' : 'Preview'}
            </button>
          </div>
          {previewMode ? (
            <div className="bg-surface-0 border border-border rounded-md p-3 min-h-[120px]">
              <MarkdownRenderer content={description || '*No description*'} />
            </div>
          ) : (
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description..."
              className={`${inputClass} h-[120px] resize-none font-mono text-xs`}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as Task['status'])} className={selectClass + ' w-full'}>
              {TASK_STATUSES.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as Task['priority'])} className={selectClass + ' w-full'}>
              {TASK_PRIORITIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Agent</label>
            <select value={agentId} onChange={e => setAgentId(e.target.value)} className={selectClass + ' w-full'}>
              <option value="">Unassigned</option>
              {ACTIVE_AGENT_IDS.map(id => (
                <option key={id} value={id}>{AGENT_EMOJIS[id]} {id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className={selectClass + ' w-full'}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-text-tertiary mb-1 block">Labels (comma-separated)</label>
          <input
            value={labels}
            onChange={e => setLabels(e.target.value)}
            placeholder="bug, feature, ..."
            className={inputClass}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          {task && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onDelete(task.id); onClose(); }}
              className="text-status-error hover:text-status-error"
            >
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!title.trim()}>
              {task ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
