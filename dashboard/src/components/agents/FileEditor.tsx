'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Eye, Edit3, Loader2 } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { useToast } from '@/components/providers/DashboardProviders';
import { cn } from '@/lib/utils';

interface FileEditorProps {
  agentId: string;
  filename: string;
  content: string;
  onSave?: (content: string) => void;
}

export function FileEditor({ agentId, filename, content, onSave }: FileEditorProps) {
  const { pushToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditContent(content);
    setHasChanges(false);
  }, [content]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: editContent }),
      });
      if (res.ok) {
        setHasChanges(false);
        setEditing(false);
        onSave?.(editContent);
        pushToast({ title: `${filename} saved`, description: `${agentId} configuration updated successfully.`, tone: 'success' });
      } else {
        const data = await res.json().catch(() => ({}));
        pushToast({ title: `Failed to save ${filename}`, description: data.error || 'The file update was rejected.', tone: 'error' });
      }
    } catch {
      pushToast({ title: `Failed to save ${filename}`, description: 'Network error while saving the file.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }, [agentId, filename, editContent, onSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && editing) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editing, handleSave]);

  const allowedToEdit = ['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md'].includes(filename);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-tertiary">{filename}</span>
          {hasChanges && (
            <span className="text-[10px] text-status-warning bg-status-warning/10 px-1.5 py-0.5 rounded">
              unsaved
            </span>
          )}
        </div>
        {allowedToEdit && (
          <div className="flex items-center gap-1.5">
            {editing && (
              <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Save
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(!editing)}
            >
              {editing ? <Eye size={12} className="mr-1" /> : <Edit3 size={12} className="mr-1" />}
              {editing ? 'Preview' : 'Edit'}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <textarea
          value={editContent}
          onChange={(e) => {
            setEditContent(e.target.value);
            setHasChanges(e.target.value !== content);
          }}
          className="w-full h-[500px] bg-surface-0 border border-border rounded-lg p-4 text-sm font-mono text-text-secondary resize-none focus:outline-none focus:border-border-active"
          spellCheck={false}
        />
      ) : (
        <div className="bg-surface-0 border border-border rounded-lg p-4">
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
