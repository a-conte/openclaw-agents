'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus } from '@/lib/types';

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function TaskColumn({ status, tasks, onTaskClick }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-h-0 w-[300px] flex-shrink-0',
        isOver && 'ring-1 ring-accent/30 rounded-lg'
      )}
    >
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {STATUS_LABELS[status]}
          </h3>
          <span className="text-[11px] text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto space-y-2 px-1 pb-4">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
