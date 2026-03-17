import type { JobContract } from '@openclaw/contracts';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { emitJobUpdated } from './mission-control-events';

const KNOWN_AGENTS = ['main', 'mail', 'docs', 'research', 'ai-research', 'dev', 'security'];

const jobs = new Map<string, JobContract>();

export function getAllJobs(): JobContract[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getJob(id: string): JobContract | undefined {
  return jobs.get(id);
}

export function isKnownAgent(agent: string): boolean {
  return KNOWN_AGENTS.includes(agent);
}

export function createJob(prompt: string, targetAgent: string, priority: JobContract['priority'] = 'normal'): JobContract {
  const job: JobContract = {
    id: `job-${randomUUID()}`,
    prompt,
    targetAgent,
    status: 'queued',
    priority,
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  emitJobUpdated(job);
  dispatchJob(job);
  return job;
}

function updateJob(id: string, updates: Partial<JobContract>): void {
  const job = jobs.get(id);
  if (!job) return;
  const updated = { ...job, ...updates };
  jobs.set(id, updated);
  emitJobUpdated(updated);
}

function dispatchJob(job: JobContract): void {
  updateJob(job.id, { status: 'running', startedAt: new Date().toISOString() });

  const command = `openclaw gateway call heartbeat --agent ${job.targetAgent}`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      updateJob(job.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: stderr || error.message,
      });
    } else {
      updateJob(job.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: stdout.trim() || 'Job completed successfully',
      });
    }
  });
}
