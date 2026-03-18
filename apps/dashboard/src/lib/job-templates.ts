import type { JobContract } from '@openclaw/contracts';

export type JobTemplate = {
  id: string;
  name: string;
  description: string;
  mode: NonNullable<JobContract['mode']>;
  targetAgent?: string;
  prompt?: string;
  command?: string;
  workflow?: string;
  args?: string[];
  workflowSpec?: Record<string, unknown>;
};

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    id: 'open_command_page',
    name: 'Open Command Page',
    description: 'Launch Safari to the local Mission Control command page.',
    mode: 'workflow',
    workflowSpec: {
      steps: [
        {
          id: 'open_command',
          name: 'Open command page',
          type: 'steer',
          command: 'open-url',
          args: ['--app', 'Safari', '--url', 'http://localhost:3000/command'],
        },
      ],
    },
  },
  {
    id: 'recover_command_page',
    name: 'Recover Command Page',
    description: 'Open the command page and recover from a Safari error page.',
    mode: 'workflow',
    workflowSpec: {
      steps: [
        {
          id: 'open_command',
          name: 'Open command page',
          type: 'steer',
          command: 'open-url',
          args: ['--app', 'Safari', '--url', 'http://localhost:3000/command'],
        },
        {
          id: 'wait_reload',
          name: 'Wait for reload UI',
          type: 'steer',
          command: 'wait',
          args: ['ui', '--app', 'Safari', '--name', 'Reload this page', '--role', 'button', '--timeout', '8', '--interval', '0.75'],
        },
        {
          id: 'click_reload',
          name: 'Click reload',
          type: 'steer',
          command: 'ui',
          args: ['click', '--app', 'Safari', '--name', 'Reload this page', '--role', 'button'],
        },
      ],
    },
  },
  {
    id: 'repo_status_check',
    name: 'Repo Status Check',
    description: 'Run a quick git status check in a managed shell session.',
    mode: 'workflow',
    workflowSpec: {
      steps: [
        {
          id: 'repo_status',
          name: 'Collect git status',
          type: 'shell',
          prompt: 'cd /Users/a_conte/dev/openclaw-agents && git status --short',
        },
      ],
    },
  },
  {
    id: 'browser_snapshot_review',
    name: 'Browser Snapshot Review',
    description: 'Open the command page and capture a Safari window screenshot and OCR snapshot.',
    mode: 'workflow',
    workflowSpec: {
      steps: [
        {
          id: 'open_page',
          name: 'Open review page',
          type: 'steer',
          command: 'open-url',
          args: ['--app', 'Safari', '--url', 'http://localhost:3000/command'],
        },
        {
          id: 'wait_page',
          name: 'Wait for page URL',
          type: 'steer',
          command: 'wait',
          args: ['url', '--url', '/command', '--contains', '--timeout', '12', '--interval', '0.75'],
        },
        {
          id: 'capture_window',
          name: 'Capture Safari window',
          type: 'steer',
          command: 'see',
          args: ['--app', 'Safari', '--window'],
        },
      ],
    },
  },
  {
    id: 'operator_handoff_note',
    name: 'Operator Handoff Note',
    description: 'Create a TextEdit handoff note for a human operator.',
    mode: 'workflow',
    workflowSpec: {
      steps: [
        {
          id: 'draft_note',
          name: 'Create handoff note',
          type: 'steer',
          command: 'textedit',
          args: ['new', '--text', 'Operator handoff:\n- Context:\n- Next action:\n- Risks:'],
        },
      ],
    },
  },
  {
    id: 'agent_brief',
    name: 'Agent Brief',
    description: 'Ask the main agent for a short operational brief.',
    mode: 'workflow',
    targetAgent: 'main',
    workflowSpec: {
      steps: [
        {
          id: 'brief',
          name: 'Generate brief',
          type: 'agent',
          targetAgent: 'main',
          prompt: 'Summarize the current operational state in 3 bullets.',
        },
      ],
    },
  },
];

export function findJobTemplate(templateId: string): JobTemplate | undefined {
  return JOB_TEMPLATES.find((template) => template.id === templateId);
}
