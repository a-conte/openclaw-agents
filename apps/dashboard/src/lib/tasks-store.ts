import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from './types';
import { withFileLock } from './file-lock';
import { resolveDashboardDataDir, resolveDashboardDataFile } from './paths';

const DATA_DIR = resolveDashboardDataDir();
const TASKS_FILE = resolveDashboardDataFile('tasks.json');
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readTasks(): Task[] {
  try {
    return JSON.parse(readFileSync(TASKS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function recoverStaleTasks(tasks: Task[]): { tasks: Task[]; changed: boolean } {
  const now = Date.now();
  let changed = false;
  for (const task of tasks) {
    if (task.status === 'in_progress' && now - new Date(task.updatedAt).getTime() > STALE_THRESHOLD_MS) {
      task.status = 'todo';
      task.labels = [...(task.labels || []), 'stale'];
      task.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  return { tasks, changed };
}

function writeTasks(tasks: Task[]): void {
  ensureDataDir();
  const tmp = TASKS_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(tasks, null, 2), 'utf-8');
  renameSync(tmp, TASKS_FILE);
}

export function getAllTasks(): Promise<Task[]> {
  return withFileLock(TASKS_FILE, () => {
    const { tasks, changed } = recoverStaleTasks(readTasks());
    if (changed) writeTasks(tasks);
    return tasks;
  });
}

export function createTask(data: Partial<Task>): Promise<Task> {
  return withFileLock(TASKS_FILE, () => {
    const tasks = readTasks();
    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      title: data.title || 'Untitled',
      description: data.description || '',
      status: data.status || 'backlog',
      priority: data.priority || 'medium',
      agentId: data.agentId,
      labels: data.labels || [],
      dueDate: data.dueDate,
      order: data.order ?? tasks.filter(t => t.status === (data.status || 'backlog')).length,
      createdAt: now,
      updatedAt: now,
    };
    tasks.push(task);
    writeTasks(tasks);
    return task;
  });
}

export function updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
  return withFileLock(TASKS_FILE, () => {
    const tasks = readTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
    writeTasks(tasks);
    return tasks[idx];
  });
}

export function deleteTask(id: string): Promise<boolean> {
  return withFileLock(TASKS_FILE, () => {
    const tasks = readTasks();
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) return false;
    writeTasks(filtered);
    return true;
  });
}
