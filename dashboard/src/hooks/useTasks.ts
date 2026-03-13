import useSWR from 'swr';
import { useToast } from '@/components/providers/DashboardProviders';
import type { Task } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useTasks() {
  const { pushToast } = useToast();
  const { data, error, isLoading, mutate } = useSWR<Task[]>('/api/tasks', fetcher);

  const createTask = async (task: Partial<Task>) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      const created = await res.json();
      if (!res.ok) {
        pushToast({ title: 'Failed to create task', description: created?.error || 'The task could not be saved.', tone: 'error' });
        return created;
      }
      mutate();
      pushToast({ title: 'Task created', description: created.title || task.title || 'New task added to the pipeline.', tone: 'success' });
      return created;
    } catch {
      pushToast({ title: 'Failed to create task', description: 'Network error while saving the task.', tone: 'error' });
      return null;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const previousTasks = data || [];
    // Optimistic update
    mutate(
      (current) =>
        current?.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      false
    );
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        mutate(previousTasks, false);
        pushToast({ title: 'Failed to update task', description: 'The server rejected the task update.', tone: 'error' });
      } else {
        pushToast({ title: 'Task updated', description: updates.title || updates.status || 'Changes saved.', tone: 'success' });
      }
    } catch {
      mutate(previousTasks, false);
      pushToast({ title: 'Failed to update task', description: 'Network error while updating the task.', tone: 'error' });
    }
    await mutate();
  };

  const deleteTask = async (id: string) => {
    const previousTasks = data || [];
    mutate(
      (current) => current?.filter((t) => t.id !== id),
      false
    );
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        mutate(previousTasks, false);
        pushToast({ title: 'Failed to delete task', description: 'The task could not be deleted.', tone: 'error' });
      } else {
        pushToast({ title: 'Task deleted', description: 'The task was removed from the pipeline.', tone: 'info' });
      }
    } catch {
      mutate(previousTasks, false);
      pushToast({ title: 'Failed to delete task', description: 'Network error while deleting the task.', tone: 'error' });
    }
    await mutate();
  };

  return {
    tasks: data || [],
    error,
    isLoading,
    mutate,
    createTask,
    updateTask,
    deleteTask,
  };
}
