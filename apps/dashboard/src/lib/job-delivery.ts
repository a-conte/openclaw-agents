import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { JobContract } from '@openclaw/contracts';
import { resolveRepoRoot } from '@/lib/paths';

const execFileAsync = promisify(execFile);

type DeliveryChannel = 'notes' | 'mail_draft' | 'imessage';

type ArtifactReference = {
  relativePath?: string;
  name?: string;
  preview?: string | null;
};

type DeliveryArtifact = {
  stepName: string;
  key: string;
  value: ArtifactReference;
};

function getPythonBinary() {
  return process.env.PYTHON_BIN?.trim() || 'python3';
}

function collectArtifacts(job: JobContract): DeliveryArtifact[] {
  if (!Array.isArray(job.stepStatus)) return [];
  const entries: DeliveryArtifact[] = [];
  for (const step of job.stepStatus) {
    if (!step?.artifacts || typeof step.artifacts !== 'object') continue;
    for (const [key, rawValue] of Object.entries(step.artifacts)) {
      if (!rawValue || typeof rawValue !== 'object' || !('relativePath' in rawValue)) continue;
      const value = rawValue as ArtifactReference;
      if (!value.relativePath) continue;
      entries.push({ stepName: step.name, key, value });
    }
  }
  return entries;
}

function artifactUrl(origin: string, jobId: string, relativePath: string) {
  return `${origin}/api/jobs/${jobId}/artifact?path=${encodeURIComponent(relativePath)}`;
}

function buildDeliveryBody(job: JobContract, origin: string, detailPath?: string) {
  const detailUrl = detailPath ? `${origin}${detailPath}` : `${origin}/command`;
  const bundleUrl = `${origin}/api/jobs/${job.id}/bundle`;
  const incidentBundleUrl = `${origin}/api/jobs/${job.id}/bundle?kind=incident`;
  const artifacts = collectArtifacts(job).filter((entry) => !['stdout', 'stderr', 'rawOutput'].includes(entry.key));
  const lines = [
    `${job.workflow || job.command || job.mode || 'Automation job'} · ${job.status}`,
    '',
    `Job ID: ${job.id}`,
    `Target agent: ${job.targetAgent || 'unknown'}`,
    `Attempt: ${job.attempt || 1}`,
    `Detail: ${detailUrl}`,
    `Bundle ZIP: ${bundleUrl}`,
    `Incident ZIP: ${incidentBundleUrl}`,
  ];
  if (job.summary?.trim()) {
    lines.push('', 'Summary:', job.summary.trim());
  }
  if (artifacts.length > 0) {
    lines.push('', 'Key artifacts:');
    for (const entry of artifacts.slice(0, 5)) {
      lines.push(`- ${entry.value.name || entry.value.preview || `${entry.stepName} ${entry.key}`}: ${artifactUrl(origin, job.id, entry.value.relativePath || '')}`);
    }
  }
  if (job.error?.trim()) {
    lines.push('', 'Error:', job.error.trim());
  }
  return lines.join('\n').trim();
}

function buildDeliveryTitle(job: JobContract) {
  return `${job.workflow || job.command || job.mode || 'Automation job'} · ${job.status}`;
}

async function runSteerJson(args: string[]) {
  const repoRoot = resolveRepoRoot();
  const scriptPath = path.join(repoRoot, 'apps', 'steer', 'steer_cli.py');
  const { stdout } = await execFileAsync(getPythonBinary(), [scriptPath, ...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as Record<string, unknown>;
}

export async function deliverJobHandoff(input: {
  job: JobContract;
  origin: string;
  channel: DeliveryChannel;
  detailPath?: string;
  mailTo?: string;
  recipient?: string;
  attachmentPath?: string;
}) {
  const title = buildDeliveryTitle(input.job);
  const body = buildDeliveryBody(input.job, input.origin, input.detailPath);

  if (input.channel === 'notes') {
    const result = await runSteerJson(['notes', 'create', '--title', title, '--body', body]);
    return { channel: input.channel, title, body, result };
  }

  if (input.channel === 'mail_draft') {
    const mailTo = input.mailTo?.trim();
    if (!mailTo) throw new Error('mailTo is required for mail drafts');
    const args = ['mail', 'draft', '--to', mailTo, '--subject', title, '--body', body];
    if (input.attachmentPath?.trim()) args.push('--attachment', input.attachmentPath.trim());
    const result = await runSteerJson(args);
    return { channel: input.channel, title, body, target: mailTo, result };
  }

  const recipient = input.recipient?.trim();
  if (!recipient) throw new Error('recipient is required for iMessage delivery');
  const result = await runSteerJson(['messages', 'send', '--recipient', recipient, '--text', body]);
  return { channel: input.channel, title, body, target: recipient, result };
}
