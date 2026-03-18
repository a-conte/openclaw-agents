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
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stopped';
  priority?: 'normal' | 'high' | 'urgent';
  mode?: 'agent' | 'shell' | 'steer' | 'drive' | 'workflow' | 'note';
  command?: string | null;
  workflow?: string | null;
  workflowSpec?: Record<string, unknown> | null;
  templateId?: string | null;
  templateInputs?: Record<string, string> | null;
  args?: string[];
  thinking?: string | null;
  local?: boolean;
  updates?: Array<{ at: string; message: string; level?: 'info' | 'error'; stepId?: string }>;
  summary?: string;
  stepStatus?: Array<{
    id: string;
    name: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    dangerous?: boolean;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    result?: unknown;
    error?: string;
    artifacts?: Record<string, unknown>;
  }>;
  currentStepId?: string | null;
  timedOut?: boolean;
  attempt?: number;
  retryOf?: string | null;
  retryMode?: 'resume_failed' | 'resume_from' | 'rerun_all' | null;
  resumeFromStepId?: string | null;
  history?: Array<{
    jobId?: string;
    attempt?: number;
    status?: string;
    mode?: string;
    resumeFromStepId?: string | null;
    completedAt?: string;
    summary?: string;
  }>;
  policy?: {
    allowed: boolean;
    reason?: string;
    allowDangerous?: boolean;
    allowedSteerCommands?: string[];
    allowedDriveCommands?: string[];
    allowedWorkflows?: string[];
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface JobTemplateContract {
  id: string;
  name: string;
  description: string;
  category?: string;
  builtIn?: boolean;
  workflowSpec?: Record<string, unknown> | null;
  inputs?: Array<{
    key: string;
    label: string;
    description?: string;
    required?: boolean;
    defaultValue?: string;
  }>;
}

export interface ArtifactAdminSummaryContract {
  active: {
    jobCount: number;
    bytes: number;
    jobs?: string[];
  };
  archived: {
    jobCount: number;
    bytes: number;
    jobs?: string[];
  };
}

export interface EventEnvelopeContract<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  sequence: number;
  eventType: string;
  entityId: string;
  emittedAt: string;
  payload: TPayload;
}
