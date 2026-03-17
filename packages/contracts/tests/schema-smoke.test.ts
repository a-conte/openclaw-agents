import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import type {
  AgentSummaryContract,
  EventEnvelopeContract,
  JobContract,
  MissionControlAgentUpdatedContract,
  MissionControlCountsContract,
  MissionControlSnapshotContract,
  MissionControlSnapshotInvalidatedContract,
  TaskContract,
  WorkflowRunContract,
} from '../src';

import agentSummarySchema from '../schemas/agent-summary.schema.json';
import eventEnvelopeSchema from '../schemas/event-envelope.schema.json';
import jobSchema from '../schemas/job.schema.json';
import missionControlAgentUpdatedSchema from '../schemas/mission-control-agent-updated.schema.json';
import missionControlCountsSchema from '../schemas/mission-control-counts.schema.json';
import missionControlSnapshotSchema from '../schemas/mission-control-snapshot.schema.json';
import missionControlSnapshotInvalidatedSchema from '../schemas/mission-control-snapshot-invalidated.schema.json';
import taskSchema from '../schemas/task.schema.json';
import workflowRunSchema from '../schemas/workflow-run.schema.json';

import agentSummariesFixture from '../fixtures/agent-summaries.sample.json';
import eventEnvelopeFixture from '../fixtures/event-envelope.sample.json';
import eventEnvelopeAgentUpdatedFixture from '../fixtures/event-envelope-agent-updated.sample.json';
import eventEnvelopeSnapshotInvalidatedFixture from '../fixtures/event-envelope-snapshot-invalidated.sample.json';
import jobQueuedFixture from '../fixtures/job-queued.sample.json';
import jobCompletedFixture from '../fixtures/job-completed.sample.json';
import jobFailedFixture from '../fixtures/job-failed.sample.json';
import missionControlAgentUpdatedFixture from '../fixtures/mission-control-agent-updated.sample.json';
import missionControlCountsFixture from '../fixtures/mission-control-counts.sample.json';
import missionControlSnapshotFixture from '../fixtures/mission-control-snapshot.sample.json';
import missionControlSnapshotInvalidatedFixture from '../fixtures/mission-control-snapshot-invalidated.sample.json';
import tasksFixture from '../fixtures/tasks.sample.json';
import workflowRunsFixture from '../fixtures/workflow-runs.sample.json';

const typedAgentSummaries: AgentSummaryContract[] = agentSummariesFixture;
const typedMissionControlCounts: MissionControlCountsContract = missionControlCountsFixture;
const typedMissionControlSnapshot: MissionControlSnapshotContract = missionControlSnapshotFixture;
const typedMissionControlAgentUpdated: MissionControlAgentUpdatedContract = missionControlAgentUpdatedFixture;
const typedMissionControlSnapshotInvalidated: MissionControlSnapshotInvalidatedContract = missionControlSnapshotInvalidatedFixture;
const typedJobQueued: JobContract = jobQueuedFixture;
const typedJobCompleted: JobContract = jobCompletedFixture;
const typedJobFailed: JobContract = jobFailedFixture;
const typedTasks: TaskContract[] = tasksFixture;
const typedWorkflowRuns: WorkflowRunContract[] = workflowRunsFixture;
const typedEventEnvelope: EventEnvelopeContract = eventEnvelopeFixture;
const typedEnvelopeAgentUpdated: EventEnvelopeContract = eventEnvelopeAgentUpdatedFixture;
const typedEnvelopeSnapshotInvalidated: EventEnvelopeContract = eventEnvelopeSnapshotInvalidatedFixture;

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  return ajv;
}

describe('contracts schemas', () => {
  it('accepts representative agent summaries', () => {
    const ajv = createAjv();
    const validate = ajv.compile(agentSummarySchema);

    for (const item of typedAgentSummaries) {
      expect(validate(item), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('accepts representative mission control counts', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlCountsSchema);

    const ok = validate(typedMissionControlCounts);

    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects positive decimal mission control counts', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlCountsSchema);

    const ok = validate({
      ...typedMissionControlCounts,
      quietAgents: 1.5
    });

    expect(ok).toBe(false);
  });

  it('rejects negative decimal mission control counts', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlCountsSchema);

    const ok = validate({
      ...typedMissionControlCounts,
      quietAgents: -1.5
    });

    expect(ok).toBe(false);
  });

  it('accepts representative tasks', () => {
    const ajv = createAjv();
    const validate = ajv.compile(taskSchema);

    for (const item of typedTasks) {
      expect(validate(item), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('accepts representative workflow runs', () => {
    const ajv = createAjv();
    const validate = ajv.compile(workflowRunSchema);

    for (const item of typedWorkflowRuns) {
      expect(validate(item), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('accepts a valid event envelope', () => {
    const ajv = createAjv();
    const validate = ajv.compile(eventEnvelopeSchema);

    const ok = validate(typedEventEnvelope);

    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects malformed event envelopes', () => {
    const ajv = createAjv();
    const validate = ajv.compile(eventEnvelopeSchema);

    const ok = validate({
      sequence: -1,
      eventType: '',
      payload: {}
    });

    expect(ok).toBe(false);
  });

  it('accepts representative mission control snapshot', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlSnapshotSchema);

    const ok = validate(typedMissionControlSnapshot);

    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects snapshot with missing agents', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlSnapshotSchema);

    const { agents: _, ...noAgents } = typedMissionControlSnapshot;
    const ok = validate(noAgents);

    expect(ok).toBe(false);
  });

  it('rejects snapshot with negative sequence', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlSnapshotSchema);

    const ok = validate({ ...typedMissionControlSnapshot, sequence: -1 });

    expect(ok).toBe(false);
  });

  it('accepts representative agent.updated payload', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlAgentUpdatedSchema);

    const ok = validate(typedMissionControlAgentUpdated);

    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects agent.updated payload without agentId', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlAgentUpdatedSchema);

    const { agentId: _, ...noId } = typedMissionControlAgentUpdated;
    const ok = validate(noId);

    expect(ok).toBe(false);
  });

  it('accepts representative snapshot.invalidated payload', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlSnapshotInvalidatedSchema);

    const ok = validate(typedMissionControlSnapshotInvalidated);

    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects snapshot.invalidated with unknown reason', () => {
    const ajv = createAjv();
    const validate = ajv.compile(missionControlSnapshotInvalidatedSchema);

    const ok = validate({ reason: 'unknown-reason' });

    expect(ok).toBe(false);
  });

  it('accepts envelope-wrapped agent.updated fixture', () => {
    const ajv = createAjv();
    const validate = ajv.compile(eventEnvelopeSchema);

    const ok = validate(typedEnvelopeAgentUpdated);

    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts envelope-wrapped snapshot.invalidated fixture', () => {
    const ajv = createAjv();
    const validate = ajv.compile(eventEnvelopeSchema);

    const ok = validate(typedEnvelopeSnapshotInvalidated);

    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts representative job fixtures', () => {
    const ajv = createAjv();
    const validate = ajv.compile(jobSchema);

    for (const fixture of [typedJobQueued, typedJobCompleted, typedJobFailed]) {
      expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('rejects job without required fields', () => {
    const ajv = createAjv();
    const validate = ajv.compile(jobSchema);

    const ok = validate({ id: 'job-x' });

    expect(ok).toBe(false);
  });

  it('rejects job with invalid status', () => {
    const ajv = createAjv();
    const validate = ajv.compile(jobSchema);

    const ok = validate({ ...typedJobQueued, status: 'pending' });

    expect(ok).toBe(false);
  });
});
