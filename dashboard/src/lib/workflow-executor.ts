import type { Workflow } from './types';
import { updateRunStep, completeRun } from './workflow-runs-store';
import { runOpenClaw } from './openclaw-cli';

export async function executeWorkflowInBackground(runId: string, workflow: Workflow): Promise<void> {
  let previousOutput = '';

  // Notify via Telegram if this workflow requires approval
  if (workflow.approvalRequired) {
    runOpenClaw(
      [
        'send', '--channel', 'telegram', '--account', 'main', '--to', '1858496116',
        '--message', `⏳ Workflow "${workflow.name}" requires approval.\nReason: ${workflow.approvalReason || 'No reason provided'}\nReview in the dashboard.`,
      ],
      { timeout: 30_000 }
    ).catch(err => {
      console.error(`Telegram approval notification failed for ${workflow.name}:`, err.stderr || err.message);
    });
  }

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const isLastStep = i === workflow.steps.length - 1;

    updateRunStep(runId, i, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    try {
      let message = step.action;
      if (step.passOutput && previousOutput) {
        message = `Context from previous step:\n${previousOutput}\n\n${step.action}`;
      }

      const args = ['agent', '--agent', step.agent, '--message', message, '--json'];

      // Deliver the last step's response via Telegram so the user
      // actually receives the workflow result.
      if (isLastStep) {
        args.push('--deliver', '--reply-channel', 'telegram', '--reply-account', 'main', '--reply-to', '1858496116');
      }

      const { stdout } = await runOpenClaw(
        args,
        {
          timeout: 600_000,
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
