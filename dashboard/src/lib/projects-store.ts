import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Project } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readProjects(): Project[] {
  try {
    return JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeProjects(projects: Project[]): void {
  ensureDataDir();
  const tmp = PROJECTS_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(projects, null, 2), 'utf-8');
  renameSync(tmp, PROJECTS_FILE);
}

export function getAllProjects(): Project[] {
  return readProjects();
}

export function createProject(data: Partial<Project>): Project {
  const projects = readProjects();
  const now = new Date().toISOString();
  const project: Project = {
    id: uuidv4(),
    name: data.name || 'Untitled Project',
    description: data.description || '',
    status: data.status || 'active',
    agentIds: data.agentIds || [],
    labels: data.labels || [],
    createdAt: now,
    updatedAt: now,
  };
  projects.push(project);
  writeProjects(projects);
  return project;
}

export function updateProject(id: string, data: Partial<Project>): Project | null {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return null;
  projects[idx] = { ...projects[idx], ...data, updatedAt: new Date().toISOString() };
  writeProjects(projects);
  return projects[idx];
}

export function deleteProject(id: string): boolean {
  const projects = readProjects();
  const filtered = projects.filter(p => p.id !== id);
  if (filtered.length === projects.length) return false;
  writeProjects(filtered);
  return true;
}