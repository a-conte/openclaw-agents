import useSWR from 'swr';
import type { Task } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useTasks() {
  const { data, error, isLoading, mutate } = useSWR<Task[]>('/api/tasks', fetcher);

  const createTask = async (task: Partial<Task>) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const created = await res.json();
    mutate();
    return created;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    // Optimistic update
    mutate(
      (current) =>
        current?.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      false
    );
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    mutate();
  };

  const deleteTask = async (id: string) => {
    mutate(
      (current) => current?.filter((t) => t.id !== id),
      false
    );
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    mutate();
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
