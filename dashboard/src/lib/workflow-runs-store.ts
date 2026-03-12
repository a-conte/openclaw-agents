import { readFileSync, writeFileSync, renameSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowRun, WorkflowRunStep, Workflow } from './types';

const RUNS_FILE = path.join(process.cwd(), 'data', 'workflow-runs.json');
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

function readRuns(): WorkflowRun[] {
  try {
    return JSON.parse(readFileSync(RUNS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeRuns(runs: WorkflowRun[]): void {
  const tmp = RUNS_FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(runs, null, 2), 'utf-8');
  renameSync(tmp, RUNS_FILE);
}

function recoverStaleRuns(runs: WorkflowRun[]): WorkflowRun[] {
  const now = Date.now();
  let changed = false;
  for (const run of runs) {
    if (run.status === 'running' && now - new Date(run.startedAt).getTime() > STALE_THRESHOLD_MS) {
      run.status = 'failed';
      run.error = 'Run timed out (stale recovery)';
      run.completedAt = new Date().toISOString();
      for (const step of run.steps) {
        if (step.status === 'running') step.status = 'failed';
        if (step.status === 'pending') step.status = 'skipped';
      }
      changed = true;
    }
  }
  if (changed) writeRuns(runs);
  return runs;
}

export function getAllRuns(): WorkflowRun[] {
  return recoverStaleRuns(readRuns());
}

export function getRun(id: string): WorkflowRun | null {
  const runs = recoverStaleRuns(readRuns());
  return runs.find(r => r.id === id) || null;
}

export function createRun(workflow: Workflow, triggeredBy: WorkflowRun['triggeredBy'] = 'dashboard'): WorkflowRun {
  const runs = readRuns();
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: uuidv4(),
    workflowName: workflow.name,
    status: 'running',
    steps: workflow.steps.map((s, i): WorkflowRunStep => ({
      stepIndex: i,
      agent: s.agent,
      action: s.action,
      status: 'pending',
    })),
    startedAt: now,
    triggeredBy,
  };
  runs.push(run);
  writeRuns(runs);
  return run;
}

export function updateRunStep(
  runId: string,
  stepIndex: number,
  data: Partial<Pick<WorkflowRunStep, 'status' | 'startedAt' | 'completedAt' | 'output' | 'error'>>
): WorkflowRun | null {
  const runs = readRuns();
  const run = runs.find(r => r.id === runId);
  if (!run) return null;
  const step = run.steps.find(s => s.stepIndex === stepIndex);
  if (!step) return null;
  Object.assign(step, data);
  writeRuns(runs);
  return run;
}

export function completeRun(runId: string, status: 'completed' | 'failed', error?: string): WorkflowRun | null {
  const runs = readRuns();
  const run = runs.find(r => r.id === runId);
  if (!run) return null;
  run.status = status;
  run.completedAt = new Date().toISOString();
  if (error) run.error = error;
  writeRuns(runs);
  return run;
}
