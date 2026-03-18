import type {
  ArtifactAdminSummaryContract,
  JobContract,
  JobMetricsContract,
  JobTemplateDiffContract,
  JobTemplateContract,
  JobTemplateVersionContract,
  PolicyAdminContract,
} from '@openclaw/contracts';
import {
  clearListenJobs,
  compressListenArtifacts,
  cloneListenTemplate,
  createListenTemplate,
  createListenJob,
  deleteListenTemplate,
  diffListenTemplateVersions,
  fetchListenArtifactBundle,
  fetchListenArtifact,
  getListenJob,
  getListenArtifactAdmin,
  getListenMetrics,
  getListenNotificationPreferences,
  getListenPolicy,
  getListenPolicyAdmin,
  listListenTemplates,
  listListenTemplateVersions,
  listListenArtifacts,
  listListenNotificationDevices,
  listListenNotificationEvents,
  listListenJobs,
  pruneListenArtifacts,
  registerListenNotificationDevice,
  resumeListenJob,
  restoreListenTemplate,
  retryListenJob,
  stopListenJob,
  updateListenNotificationPreferences,
  updateListenTemplate,
} from './listen-client';

const KNOWN_AGENTS = ['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'];

export function isKnownAgent(agent: string): boolean {
  return KNOWN_AGENTS.includes(agent);
}

export async function getAllJobs(archived = false): Promise<JobContract[]> {
  return listListenJobs(archived);
}

export async function getJob(id: string): Promise<JobContract | undefined> {
  try {
    return await getListenJob(id);
  } catch {
    return undefined;
  }
}

export async function createJob(input: {
  prompt?: string;
  targetAgent?: string;
  priority?: JobContract['priority'];
  mode: NonNullable<JobContract['mode']>;
  command?: string;
  workflow?: string;
  args?: string[];
  workflowSpec?: Record<string, unknown>;
  templateId?: string;
  templateInputs?: Record<string, string>;
  thinking?: string;
  local?: boolean;
}): Promise<JobContract> {
  return createListenJob({
    prompt: input.prompt,
    mode: input.mode,
    targetAgent: input.targetAgent,
    command: input.command,
    workflow: input.workflow,
    args: input.args,
    workflowSpec: input.workflowSpec,
    templateId: input.templateId,
    templateInputs: input.templateInputs,
    thinking: input.thinking,
    local: input.local,
  });
}

export async function stopJob(id: string) {
  return stopListenJob(id);
}

export async function retryJob(id: string) {
  return retryListenJob(id);
}

export async function resumeJob(
  id: string,
  input: { mode: 'resume_failed' | 'resume_from' | 'rerun_all'; resumeFromStepId?: string },
) {
  return resumeListenJob(id, input);
}

export async function clearJobs() {
  return clearListenJobs();
}

export async function getJobsPolicy() {
  return getListenPolicy();
}

export async function getJobTemplates() {
  return listListenTemplates();
}

export async function createJobTemplate(input: JobTemplateContract) {
  return createListenTemplate(input);
}

export async function updateJobTemplate(id: string, input: JobTemplateContract) {
  return updateListenTemplate(id, input);
}

export async function deleteJobTemplate(id: string) {
  return deleteListenTemplate(id);
}

export async function getJobTemplateVersions(id: string): Promise<JobTemplateVersionContract[]> {
  return listListenTemplateVersions(id);
}

export async function diffJobTemplateVersions(id: string, fromVersion: number, toVersion?: number): Promise<JobTemplateDiffContract> {
  return diffListenTemplateVersions(id, fromVersion, toVersion);
}

export async function cloneJobTemplate(id: string, input?: { id?: string; name?: string }) {
  return cloneListenTemplate(id, input);
}

export async function restoreJobTemplate(id: string, version: number) {
  return restoreListenTemplate(id, version);
}

export async function getArtifactAdmin(): Promise<ArtifactAdminSummaryContract> {
  return getListenArtifactAdmin();
}

export async function pruneArtifacts(olderThanDays: number) {
  return pruneListenArtifacts(olderThanDays);
}

export async function compressArtifacts(olderThanDays: number) {
  return compressListenArtifacts(olderThanDays);
}

export async function getJobMetrics(): Promise<JobMetricsContract> {
  return getListenMetrics();
}

export async function getJobsPolicyAdmin(): Promise<PolicyAdminContract> {
  return getListenPolicyAdmin();
}

export async function getNotificationPreferences() {
  return getListenNotificationPreferences();
}

export async function updateNotificationPreferences(input: Parameters<typeof updateListenNotificationPreferences>[0]) {
  return updateListenNotificationPreferences(input);
}

export async function getNotificationEvents(limit?: number) {
  return listListenNotificationEvents(limit);
}

export async function getNotificationDevices() {
  return listListenNotificationDevices();
}

export async function registerNotificationDevice(input: Parameters<typeof registerListenNotificationDevice>[0]) {
  return registerListenNotificationDevice(input);
}

export async function getJobArtifacts(id: string) {
  return listListenArtifacts(id);
}

export async function getJobArtifact(id: string, relativePath: string) {
  return fetchListenArtifact(id, relativePath);
}

export async function getJobArtifactBundle(id: string, kind = 'bundle') {
  return fetchListenArtifactBundle(id, kind);
}
