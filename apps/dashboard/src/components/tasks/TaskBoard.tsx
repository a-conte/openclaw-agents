'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { TASK_STATUSES } from '@/lib/constants';
import type { Task, TaskStatus } from '@/lib/types';

interface TaskBoardProps {
  tasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onCreate: (task: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskBoard({ tasks, onUpdate, onCreate, onDelete }: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const tasksByStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status] = tasks
      .filter(t => t.status === status)
      .sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overStatus = (TASK_STATUSES as readonly string[]).includes(over.id as string)
      ? (over.id as TaskStatus)
      : tasks.find(t => t.id === over.id)?.status;

    if (overStatus) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== overStatus) {
        onUpdate(taskId, { status: overStatus });
      }
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto px-1 pb-4">
          {TASK_STATUSES.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskClick={handleTaskClick}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <div className="w-[280px]">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedTask(null); }}
        onSave={onUpdate}
        onCreate={onCreate}
        onDelete={onDelete}
      />
    </>
  );
}
