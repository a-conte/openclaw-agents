export const AGENT_COLORS: Record<string, string> = {
  main: '#7c5cfc',
  mail: '#f59e0b',
  docs: '#3b82f6',
  research: '#10b981',
  'ai-research': '#8b5cf6',
  dev: '#ec4899',
  security: '#ef4444',
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
  'openai/gpt-5.2': { label: 'GPT-5.2', color: '#3b82f6' },
  'openai/gpt-4o-mini': { label: 'GPT-4o Mini', color: '#6b7280' },
  'openai-codex/gpt-5.3-codex': { label: 'Codex 5.3', color: '#8b5cf6' },
};

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#6b7280',
};

export const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

export const AGENT_FILES = ['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md'] as const;

export const POLL_INTERVAL = 15000;
