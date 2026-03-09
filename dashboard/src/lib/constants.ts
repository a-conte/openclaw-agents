export const AGENT_COLORS: Record<string, string> = {
  main: '#FB5656',
  mail: '#ffd166',
  docs: '#4A9EFF',
  research: '#06d6a0',
  'ai-research': '#8338ec',
  dev: '#e94560',
  security: '#ff6b35',
};

export const AGENT_ROLES: Record<string, string> = {
  main: 'Chief Orchestrator — coordinates all agents, talks to Anthony',
  mail: 'Communications — email triage, notifications, outreach',
  docs: 'Content & Docs — drafts, reports, documentation',
  research: 'Research & Recon — external scanning, opportunity detection',
  'ai-research': 'AI Research — model evaluation, AI landscape analysis',
  dev: 'Code & Systems — builds tools, scripts, infrastructure',
  security: 'Security & Compliance — monitoring, audits, threat detection',
};

export const AGENT_EMOJIS: Record<string, string> = {
  main: '🧠',
  mail: '📧',
  docs: '📝',
  research: '🔬',
  'ai-research': '🤖',
  dev: '💻',
  security: '🔒',
};

export const MODEL_DISPLAY: Record<string, { label: string; color: string }> = {
  'openai/gpt-5.2': { label: 'GPT-5.2', color: '#4A9EFF' },
  'openai/gpt-4o-mini': { label: 'GPT-4o Mini', color: '#555555' },
  'openai-codex/gpt-5.3-codex': { label: 'Codex 5.3', color: '#8338ec' },
};

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
export const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#e94560',
  high: '#ffd166',
  medium: '#4A9EFF',
  low: '#555555',
};

export const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export const PIPELINE_STAGES: Record<string, { label: string; color: string }> = {
  backlog: { label: 'Intake', color: '#555555' },
  todo: { label: 'Research', color: '#4A9EFF' },
  in_progress: { label: 'Build', color: '#FB5656' },
  review: { label: 'Review', color: '#ffd166' },
  done: { label: 'Deploy', color: '#8338ec' },
};

export const AGENT_FILES = ['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md'] as const;

export const POLL_INTERVAL = 15000;

export const MISSION_STATEMENT = 'An autonomous organization of AI agents that produces value 24/7 — researching, building, analyzing, and executing on Anthony\'s behalf.';
