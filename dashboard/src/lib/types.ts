export interface Agent {
  agentId: string;
  name?: string;
  model?: string;
  workspace?: string;
  agentDir?: string;
  isDefault?: boolean;
  heartbeat: {
    enabled: boolean;
    every: string;
    everyMs: number;
    prompt: string;
    target: string;
    ackMaxChars: number;
  };
  sessions: {
    path: string;
    count: number;
    recent: Array<{
      key: string;
      updatedAt: number;
      age: number;
    }>;
  };
  // merged from config
  emoji?: string;
  status?: 'online' | 'warning' | 'offline';
  lastActivity?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  agentId?: string;
  labels: string[];
  projectId?: string;
  dueDate?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agentId: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: 'success' | 'failure';
}

export interface Session {
  key: string;
  sessionId: string;
  updatedAt: number;
  systemSent: boolean;
  abortedLastRun: boolean;
  chatType: string;
  origin?: {
    label: string;
    provider: string;
    surface: string;
    chatType: string;
    from: string;
    to: string;
  };
  sessionFile: string;
  compactionCount: number;
}

export interface SessionMessage {
  type: string;
  id: string;
  parentId?: string;
  timestamp: string;
  message?: {
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{ type: string; text?: string }>;
  };
  // for model_change type
  provider?: string;
  modelId?: string;
}

export interface HealthResponse {
  ok: boolean;
  ts: number;
  durationMs: number;
  heartbeatSeconds: number;
  defaultAgentId: string;
  agents: Agent[];
  sessions: {
    path: string;
    count: number;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'paused';
  agentIds: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  title: string;
  category: string;
  date: string;
  agentId: string;
  path: string;
  size: number;
}

export interface RadarItem {
  id: string;
  type: 'opportunity' | 'alert' | 'watch';
  title: string;
  signal: 'high' | 'medium' | 'low';
  source: string;
  body?: string;
  timestamp: string;
}

export interface MemoryCategory {
  agentId: string;
  category: string;
  entries: string[];
}

export interface Briefing {
  id: string;
  name: string;
  schedule: string;
  agentId: string;
  time: string;
  status: 'delivered' | 'pending' | 'scheduled';
}

export interface WorkflowStep {
  agent: string;
  action: string;
  passOutput: boolean;
}

export interface Workflow {
  name: string;
  description: string;
  trigger: 'on-demand' | 'cron' | 'event';
  schedule?: string;
  keyword?: string;
  approvalRequired: boolean;
  approvalReason?: string;
  steps: WorkflowStep[];
  source: 'workflow' | 'pipeline';
}

export interface RepoStatus {
  owner: string;
  name: string;
  local: string;
  watch: string[];
  default_branch: string;
  status: 'clean' | 'dirty' | 'missing';
  uncommittedCount: number;
  lastCommit: string | null;
  lastCommitDate: string | null;
}

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];
export type AgentStatus = 'online' | 'warning' | 'offline';
