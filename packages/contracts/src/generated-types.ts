export interface AgentSummaryContract {
  agentId: string;
  name?: string;
  status?: 'online' | 'warning' | 'offline';
  lastActivity?: number;
}

export interface MissionControlCountsContract {
  quietAgents: number;
  staleTasks: number;
  failedRuns: number;
  inProgressTasks: number;
  dirtyRepos: number;
  radarCount: number;
}

export interface TaskContract {
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

export type WorkflowRunStepStatusContract = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export type WorkflowRunStatusContract = 'pending' | 'running' | 'completed' | 'failed';

export interface WorkflowRunStepContract {
  stepIndex: number;
  agent: string;
  action: string;
  status: WorkflowRunStepStatusContract;
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

export interface WorkflowRunContract {
  id: string;
  workflowName: string;
  status: WorkflowRunStatusContract;
  steps: WorkflowRunStepContract[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  triggeredBy: 'dashboard' | 'cron' | 'api';
}

export interface MissionControlSnapshotContract {
  sequence: number;
  generatedAt: string;
  agents: AgentSummaryContract[];
  counts: MissionControlCountsContract;
}

export interface MissionControlAgentUpdatedContract {
  agentId: string;
  name?: string;
  status?: 'online' | 'warning' | 'offline';
  lastActivity?: number;
}

export interface MissionControlSnapshotInvalidatedContract {
  reason: 'counts-changed' | 'agent-added' | 'agent-removed' | 'resume-gap';
}

export interface JobContract {
  id: string;
  prompt: string;
  targetAgent: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  priority: 'normal' | 'high' | 'urgent';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
}

export interface EventEnvelopeContract<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  sequence: number;
  eventType: string;
  entityId: string;
  emittedAt: string;
  payload: TPayload;
}
