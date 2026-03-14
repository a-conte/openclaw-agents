import { describe, it, expect } from 'vitest';
import { isActiveAgent, ALL_AGENT_IDS, ACTIVE_AGENT_IDS } from './constants';

describe('isActiveAgent', () => {
  it('returns true for active agents', () => {
    for (const id of ACTIVE_AGENT_IDS) {
      expect(isActiveAgent(id)).toBe(true);
    }
  });

  it('returns false for unknown agents', () => {
    expect(isActiveAgent('nonexistent')).toBe(false);
  });

  it('ALL_AGENT_IDS is a superset of ACTIVE_AGENT_IDS', () => {
    for (const id of ACTIVE_AGENT_IDS) {
      expect(ALL_AGENT_IDS).toContain(id);
    }
  });
});
