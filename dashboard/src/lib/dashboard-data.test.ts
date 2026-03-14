import { describe, it, expect } from 'vitest';
import { buildSystemRecommendations } from './dashboard-data';

const baseInput = {
  healthOk: true,
  agents: [],
  tasks: [],
  runs: [],
  repos: [],
  briefings: [],
  radarItems: [],
};

describe('buildSystemRecommendations', () => {
  it('returns empty for healthy system with no issues', () => {
    const recs = buildSystemRecommendations(baseInput);
    // May include informational recommendations but no danger ones
    const dangerRecs = recs.filter((r) => r.tone === 'danger');
    expect(dangerRecs).toHaveLength(0);
  });

  it('flags gateway recovery when health is not ok', () => {
    const recs = buildSystemRecommendations({ ...baseInput, healthOk: false });
    expect(recs.some((r) => r.id === 'gateway-recovery')).toBe(true);
  });

  it('flags failed workflow runs', () => {
    const recs = buildSystemRecommendations({
      ...baseInput,
      runs: [
        {
          id: '1',
          workflowName: 'test-workflow',
          status: 'failed',
          startedAt: new Date().toISOString(),
          triggeredBy: 'dashboard',
          steps: [],
          error: 'something broke',
        },
      ] as never[],
    });
    expect(recs.some((r) => r.id === 'failed-workflow')).toBe(true);
  });

  it('flags stale in-progress tasks', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const recs = buildSystemRecommendations({
      ...baseInput,
      tasks: [
        { id: '1', title: 'test', status: 'in_progress', updatedAt: threeHoursAgo },
      ] as never[],
    });
    expect(recs.some((r) => r.id === 'stale-task-recovery')).toBe(true);
  });

  it('flags dirty repos', () => {
    const recs = buildSystemRecommendations({
      ...baseInput,
      repos: [{ name: 'test-repo', status: 'dirty', uncommittedCount: 3 }] as never[],
    });
    expect(recs.some((r) => r.id === 'repo-hygiene')).toBe(true);
  });
});
