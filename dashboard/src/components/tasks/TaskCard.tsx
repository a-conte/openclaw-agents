'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar as CalendarIcon } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { PRIORITY_COLORS, AGENT_EMOJIS } from '@/lib/constants';
import { Badge } from '@/components/shared/Badge';
import type { Task } from '@/lib/types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-surface-2 border border-border rounded-md p-3 cursor-pointer hover:border-border-hover transition-all',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-1 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
            />
            <p className="text-sm text-text-primary truncate">{task.title}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {task.agentId && (
              <Badge color={PRIORITY_COLORS[task.priority] || '#6b7280'}>
                {AGENT_EMOJIS[task.agentId] || '🤖'} {task.agentId}
              </Badge>
            )}
            {task.labels.map((label) => (
              <Badge key={label} variant="outline">{label}</Badge>
            ))}
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                <CalendarIcon size={10} />
                {formatDate(task.dueDate, 'MMM d')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
