import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Workflow } from './types';
import { updateRunStep, completeRun } from './workflow-runs-store';

const execFileAsync = promisify(execFile);

export async function executeWorkflowInBackground(runId: string, workflow: Workflow): Promise<void> {
  let previousOutput = '';

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    updateRunStep(runId, i, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    try {
      let message = step.action;
      if (step.passOutput && previousOutput) {
        message = `Context from previous step:\n${previousOutput}\n\n${step.action}`;
      }

      // Strip OPENCLAW_AGENTS and OPENCLAW_HOME from env — the .env.local values
      // point to the workspace repo/config, which conflicts with the CLI's
      // internal agent registry lookup.
      const { OPENCLAW_AGENTS: _a, OPENCLAW_HOME: _h, ...cleanEnv } = process.env;

      const { stdout } = await execFileAsync(
        '/usr/local/bin/openclaw',
        ['agent', '--agent', step.agent, '--message', message, '--json', '--local'],
        {
          timeout: 600_000,
          encoding: 'utf-8',
          env: cleanEnv,
          cwd: process.env.HOME || '/Users/a_conte',
        }
      );

      previousOutput = stdout.trim();

      updateRunStep(runId, i, {
        status: 'done',
        completedAt: new Date().toISOString(),
        output: previousOutput.slice(0, 5000),
      });
    } catch (err: any) {
      const errorMsg = err.stderr || err.message || 'Unknown error';

      updateRunStep(runId, i, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: errorMsg.slice(0, 2000),
      });

      // Mark remaining steps as skipped
      for (let j = i + 1; j < workflow.steps.length; j++) {
        updateRunStep(runId, j, { status: 'skipped' });
      }

      completeRun(runId, 'failed', errorMsg.slice(0, 2000));
      return;
    }
  }

  completeRun(runId, 'completed');
}
