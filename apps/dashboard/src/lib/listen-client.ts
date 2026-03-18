import type {
  ArtifactAdminSummaryContract,
  JobContract,
  JobMetricsContract,
  JobTemplateDiffContract,
  JobTemplateContract,
  JobTemplateVersionContract,
  PolicyAdminContract,
} from '@openclaw/contracts';

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
  templateId?: string;
  templateInputs?: Record<string, string>;
};

export type ListenPolicy = {
  version?: number;
  allowDangerous: boolean;
  allowedSteerCommands?: string[];
  allowedDriveCommands?: string[];
  allowedWorkflows?: string[];
};

export type ListenTemplate = JobTemplateContract;
export type ListenArtifact = {
  kind?: string;
  relativePath: string;
  path?: string;
  name?: string;
  size?: number;
  preview?: string | null;
  sourcePath?: string;
};

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

export type NotificationPreferences = {
  dashboardPrimary: boolean;
  severityThreshold: NotificationSeverity;
  channels: {
    push: boolean;
    notes: boolean;
    imessage: boolean;
    mail_draft: boolean;
  };
  agentAllowlist: string[];
  templateAllowlist: string[];
  updatedAt?: string;
};

export type NotificationDevice = {
  id: string;
  name: string;
  platform: string;
  token?: string | null;
  registeredAt?: string;
  lastSeenAt?: string;
};

export type NotificationEvent = {
  id: string;
  jobId: string;
  status: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  channels: string[];
  createdAt: string;
  targetAgent?: string | null;
  templateId?: string | null;
  summary?: string | null;
  dashboardPrimary?: boolean;
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

export async function listListenTemplates(): Promise<ListenTemplate[]> {
  const payload = await listenFetch<{ templates: ListenTemplate[] }>('/templates');
  return payload.templates;
}

export async function createListenTemplate(input: ListenTemplate): Promise<ListenTemplate> {
  return listenFetch<ListenTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateListenTemplate(templateId: string, input: ListenTemplate): Promise<ListenTemplate> {
  return listenFetch<ListenTemplate>(`/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteListenTemplate(templateId: string): Promise<{ ok?: boolean; deleted: string }> {
  return listenFetch<{ ok?: boolean; deleted: string }>(`/templates/${templateId}`, { method: 'DELETE' });
}

export async function cloneListenTemplate(templateId: string, input?: { id?: string; name?: string }): Promise<ListenTemplate> {
  return listenFetch<ListenTemplate>(`/templates/${templateId}/clone`, {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
}

export async function restoreListenTemplate(templateId: string, version: number): Promise<ListenTemplate> {
  return listenFetch<ListenTemplate>(`/templates/${templateId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export async function listListenTemplateVersions(templateId: string): Promise<JobTemplateVersionContract[]> {
  const payload = await listenFetch<{ versions: JobTemplateVersionContract[] }>(`/templates/${templateId}/versions`);
  return payload.versions;
}

export async function diffListenTemplateVersions(templateId: string, fromVersion: number, toVersion?: number): Promise<JobTemplateDiffContract> {
  const query = new URLSearchParams({ from: String(fromVersion) });
  if (typeof toVersion === 'number') query.set('to', String(toVersion));
  return listenFetch<JobTemplateDiffContract>(`/templates/${templateId}/diff?${query.toString()}`);
}

export async function getListenJob(jobId: string): Promise<JobContract> {
  return listenFetch<JobContract>(`/job/${jobId}`);
}

export async function listListenArtifacts(jobId: string): Promise<ListenArtifact[]> {
  const payload = await listenFetch<{ artifacts: ListenArtifact[] }>(`/job/${jobId}/artifacts`);
  return payload.artifacts;
}

export async function fetchListenArtifact(jobId: string, relativePath: string): Promise<Response> {
  const response = await fetch(buildUrl(`/job/${jobId}/artifact?path=${encodeURIComponent(relativePath)}`), {
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Listen artifact request failed with ${response.status}`);
  }
  return response;
}

export async function fetchListenArtifactBundle(jobId: string, kind = 'bundle'): Promise<Response> {
  const response = await fetch(buildUrl(`/job/${jobId}/bundle?kind=${encodeURIComponent(kind)}`), {
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Listen artifact bundle request failed with ${response.status}`);
  }
  return response;
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
      templateId: input.templateId,
      templateInputs: input.templateInputs,
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

export async function resumeListenJob(
  jobId: string,
  input: { mode: 'resume_failed' | 'resume_from' | 'rerun_all'; resumeFromStepId?: string },
): Promise<JobContract> {
  const created = await listenFetch<{ job_id: string }>(`/job/${jobId}/retry`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return getListenJob(created.job_id);
}

export async function clearListenJobs(): Promise<{ archived: number }> {
  return listenFetch<{ archived: number }>('/jobs/clear', { method: 'POST' });
}

export async function getListenArtifactAdmin(): Promise<ArtifactAdminSummaryContract> {
  return listenFetch<ArtifactAdminSummaryContract>('/artifacts/admin');
}

export async function pruneListenArtifacts(olderThanDays: number): Promise<{ removedJobs: string[]; removedBytes: number; olderThanDays: number }> {
  return listenFetch<{ removedJobs: string[]; removedBytes: number; olderThanDays: number }>('/artifacts/prune', {
    method: 'POST',
    body: JSON.stringify({ olderThanDays }),
  });
}

export async function compressListenArtifacts(olderThanDays: number): Promise<{ compressedJobs: string[]; compressedBytes: number; olderThanDays: number }> {
  return listenFetch<{ compressedJobs: string[]; compressedBytes: number; olderThanDays: number }>('/artifacts/compress', {
    method: 'POST',
    body: JSON.stringify({ olderThanDays }),
  });
}

export async function getListenMetrics(): Promise<JobMetricsContract> {
  return listenFetch<JobMetricsContract>('/metrics');
}

export async function getListenShortcutsSummary(): Promise<Record<string, unknown>> {
  return listenFetch<Record<string, unknown>>('/shortcuts/summary');
}

export async function getListenShortcutsLatestFailed(): Promise<Record<string, unknown>> {
  return listenFetch<Record<string, unknown>>('/shortcuts/latest-failed');
}

export async function listListenShortcutsTemplates(): Promise<Record<string, unknown>> {
  return listenFetch<Record<string, unknown>>('/shortcuts/templates');
}

export async function runListenShortcutTemplate(input: {
  templateId: string;
  templateInputs?: Record<string, string>;
  targetAgent?: string;
  wait?: boolean;
  timeout?: number;
  pollInterval?: number;
}): Promise<Record<string, unknown>> {
  return listenFetch<Record<string, unknown>>('/shortcuts/run-template', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function retryListenShortcutLatestFailed(input?: {
  mode?: 'resume_failed' | 'resume_from' | 'rerun_all';
  resumeFromStepId?: string;
}): Promise<Record<string, unknown>> {
  return listenFetch<Record<string, unknown>>('/shortcuts/retry-latest-failed', {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
}

export async function getListenPolicyAdmin(): Promise<PolicyAdminContract> {
  return listenFetch<PolicyAdminContract>('/policy/admin');
}

export async function getListenNotificationPreferences(): Promise<NotificationPreferences> {
  return listenFetch<NotificationPreferences>('/notifications/preferences');
}

export async function updateListenNotificationPreferences(input: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  return listenFetch<NotificationPreferences>('/notifications/preferences', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listListenNotificationEvents(limit = 25): Promise<NotificationEvent[]> {
  const payload = await listenFetch<{ events: NotificationEvent[] }>(`/notifications/events?limit=${encodeURIComponent(String(limit))}`);
  return payload.events;
}

export async function listListenNotificationDevices(): Promise<NotificationDevice[]> {
  const payload = await listenFetch<{ devices: NotificationDevice[] }>('/notifications/devices');
  return payload.devices;
}

export async function registerListenNotificationDevice(input: {
  id?: string;
  name?: string;
  platform?: string;
  token?: string;
}): Promise<NotificationDevice> {
  return listenFetch<NotificationDevice>('/notifications/devices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
