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
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  agentId?: string;
  labels: string[];
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

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];
export type AgentStatus = 'online' | 'warning' | 'offline';
