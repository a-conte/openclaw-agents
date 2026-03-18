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
    id: 'open-command-page',
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
    id: 'repo-status-check',
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
    id: 'operator-handoff-note',
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
    id: 'agent-brief',
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
