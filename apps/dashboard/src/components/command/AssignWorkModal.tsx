'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Zap } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { useToast } from '@/components/providers/DashboardProviders';
import { ACTIVE_AGENT_IDS, AGENT_EMOJIS, AGENT_ROLES } from '@/lib/constants';
import type { Task } from '@/lib/types';

export interface AssignWorkContext {
  agentId?: string;
  title: string;
  instructions: string;
  priority?: Task['priority'];
}

interface AssignWorkModalProps {
  context: AssignWorkContext | null;
  onClose: () => void;
  onAssigned?: () => void;
}

export function AssignWorkModal({ context, onClose, onAssigned }: AssignWorkModalProps) {
  const { pushToast } = useToast();
  const [agentId, setAgentId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [submitting, setSubmitting] = useState<'run' | 'create' | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Sync state when context changes
  useEffect(() => {
    if (context) {
      setAgentId(context.agentId || '');
      setTitle(context.title);
      setInstructions(context.instructions);
      setPriority(context.priority || 'medium');
      setSubmitting(null);
    }
  }, [context]);

  if (!context) return null;

  async function submit(action: 'run' | 'create') {
    if (!agentId) {
      pushToast({ title: 'Select an agent', description: 'Pick which agent should handle this work.', tone: 'error' });
      return;
    }
    if (!title.trim()) {
      pushToast({ title: 'Title required', description: 'Give the task a short title.', tone: 'error' });
      return;
    }

    setSubmitting(action);
    try {
      const res = await fetch(`/api/agents/${agentId}/recommendations/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'run' ? 'run' : 'create',
          type: 'suggestion',
          title: title.trim(),
          description: instructions.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        pushToast({ title: 'Failed to assign work', description: data?.error || 'Something went wrong.', tone: 'error' });
        return;
      }

      pushToast({
        title: action === 'run' ? 'Agent dispatched' : 'Task created',
        description: action === 'run'
          ? `${AGENT_EMOJIS[agentId] || ''} ${agentId} is working on: ${title.trim()}${data?.jobId ? ` · job ${data.jobId} is now visible in Automation Jobs` : ''}`
          : `Task queued for ${agentId}`,
        tone: 'success',
      });
      onAssigned?.();
      onClose();
    } catch {
      pushToast({ title: 'Network error', description: 'Could not reach the server.', tone: 'error' });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-border bg-surface-1 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)] glass">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Assign Work to Agent</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-text-secondary">
            <div className="font-medium text-text-primary">Recommended path</div>
            <div className="mt-1">
              <span className="font-medium text-text-primary">Assign &amp; Run</span> creates a real automation job that shows up in <span className="font-medium text-text-primary">Automation Jobs</span>.
              <span className="ml-1">Use <span className="font-medium text-text-primary">Assign only</span> only if you want to record ownership without starting work yet.</span>
            </div>
          </div>

          {/* Agent selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            >
              <option value="">Select an agent...</option>
              {ACTIVE_AGENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {AGENT_EMOJIS[id] || ''} {id} — {AGENT_ROLES[id]?.split('—')[0]?.trim() || id}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Detailed instructions for the agent..."
              rows={5}
              className="w-full resize-y rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-accent"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Priority</label>
            <div className="flex gap-2">
              {(['urgent', 'high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    priority === p
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-surface-2 text-text-secondary hover:bg-surface-3'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => submit('create')}
            disabled={!!submitting}
            className="text-xs text-text-tertiary transition-colors hover:text-text-secondary disabled:opacity-50"
          >
            {submitting === 'create' ? 'Saving assignment...' : 'Assign only (save ownership)'}
          </button>
          <Button
            variant="primary"
            size="md"
            onClick={() => submit('run')}
            disabled={!!submitting}
          >
            {submitting === 'run' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            <span className="ml-1.5">{submitting === 'run' ? 'Starting agent job...' : 'Assign & Start Agent'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
