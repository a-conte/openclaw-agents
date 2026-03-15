import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import type {
  AgentSummaryContract,
  EventEnvelopeContract,
  TaskContract,
  WorkflowRunContract,
} from '../src';

import agentSummarySchema from '../schemas/agent-summary.schema.json';
import eventEnvelopeSchema from '../schemas/event-envelope.schema.json';
import taskSchema from '../schemas/task.schema.json';
import workflowRunSchema from '../schemas/workflow-run.schema.json';

import agentSummariesFixture from '../fixtures/agent-summaries.sample.json';
import eventEnvelopeFixture from '../fixtures/event-envelope.sample.json';
import tasksFixture from '../fixtures/tasks.sample.json';
import workflowRunsFixture from '../fixtures/workflow-runs.sample.json';

const typedAgentSummaries: AgentSummaryContract[] = agentSummariesFixture;
const typedTasks: TaskContract[] = tasksFixture;
const typedWorkflowRuns: WorkflowRunContract[] = workflowRunsFixture;
const typedEventEnvelope: EventEnvelopeContract = eventEnvelopeFixture;

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
});
