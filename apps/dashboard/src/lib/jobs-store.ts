import type { JobContract } from '@openclaw/contracts';
import {
  clearListenJobs,
  createListenJob,
  getListenJob,
  getListenPolicy,
  listListenTemplates,
  listListenJobs,
  resumeListenJob,
  retryListenJob,
  stopListenJob,
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
