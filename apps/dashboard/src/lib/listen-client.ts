import type { JobContract } from '@openclaw/contracts';

const DEFAULT_BASE_URL = process.env.OPENCLAW_LISTEN_BASE_URL?.trim() || 'http://127.0.0.1:7600';

type CreateAutomationJobInput = {
  prompt?: string;
  mode: 'agent' | 'shell' | 'steer' | 'drive' | 'workflow' | 'note';
  targetAgent?: string;
  thinking?: string;
  local?: boolean;
  command?: string;
  workflow?: string;
  args?: string[];
  workflowSpec?: Record<string, unknown>;
};

export type ListenPolicy = {
  version?: number;
  allowDangerous: boolean;
  allowedSteerCommands?: string[];
  allowedDriveCommands?: string[];
  allowedWorkflows?: string[];
};

function buildUrl(path: string) {
  return `${DEFAULT_BASE_URL}${path}`;
}

async function listenFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Listen request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listListenJobs(archived = false): Promise<JobContract[]> {
  const payload = await listenFetch<{ jobs: JobContract[] }>(`/jobs${archived ? '?archived=true' : ''}`);
  return payload.jobs;
}

export async function getListenPolicy(): Promise<ListenPolicy> {
  return listenFetch<ListenPolicy>('/policy');
}

export async function getListenJob(jobId: string): Promise<JobContract> {
  return listenFetch<JobContract>(`/job/${jobId}`);
}

export async function createListenJob(input: CreateAutomationJobInput): Promise<JobContract> {
  const created = await listenFetch<{ job_id: string }>('/job', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt ?? '',
      mode: input.mode,
      targetAgent: input.targetAgent ?? 'main',
      thinking: input.thinking,
      local: input.local ?? false,
      command: input.command,
      workflow: input.workflow,
      args: input.args ?? [],
      workflowSpec: input.workflowSpec,
    }),
  });
  return getListenJob(created.job_id);
}

export async function stopListenJob(jobId: string): Promise<{ ok?: boolean; job_id: string }> {
  return listenFetch<{ ok?: boolean; job_id: string }>(`/job/${jobId}`, { method: 'DELETE' });
}

export async function retryListenJob(jobId: string): Promise<JobContract> {
  const created = await listenFetch<{ job_id: string }>(`/job/${jobId}/retry`, { method: 'POST' });
  return getListenJob(created.job_id);
}

export async function clearListenJobs(): Promise<{ archived: number }> {
  return listenFetch<{ archived: number }>('/jobs/clear', { method: 'POST' });
}
