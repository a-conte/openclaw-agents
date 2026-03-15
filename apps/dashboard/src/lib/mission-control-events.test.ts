import { describe, expect, it } from 'vitest';
import { emitAgentUpdated, emitSnapshotInvalidated, getBufferedEventsSince, subscribe } from './mission-control-events';
import { getSequence } from './mission-control';

describe('mission-control-events', () => {
  describe('emitAgentUpdated', () => {
    it('emits an agent.updated event with correct envelope', () => {
      const events: unknown[] = [];
      const unsub = subscribe((e) => events.push(e));

      emitAgentUpdated({ agentId: 'main', name: 'main', status: 'online', lastActivity: Date.now() });

      unsub();
      expect(events).toHaveLength(1);
      const env = events[0] as any;
      expect(env.eventType).toBe('agent.updated');
      expect(env.entityId).toBe('main');
      expect(env.payload.agentId).toBe('main');
      expect(env.sequence).toBeGreaterThan(0);
    });
  });

  describe('emitSnapshotInvalidated', () => {
    it('emits a snapshot.invalidated event with correct envelope', () => {
      const events: unknown[] = [];
      const unsub = subscribe((e) => events.push(e));

      emitSnapshotInvalidated({ reason: 'counts-changed' });

      unsub();
      expect(events).toHaveLength(1);
      const env = events[0] as any;
      expect(env.eventType).toBe('snapshot.invalidated');
      expect(env.entityId).toBe('mission-control');
      expect(env.payload.reason).toBe('counts-changed');
    });
  });

  describe('sequence monotonicity', () => {
    it('each emitted event has a higher sequence than the previous', () => {
      const seqs: number[] = [];
      const unsub = subscribe((e) => seqs.push(e.sequence));

      emitAgentUpdated({ agentId: 'a' });
      emitSnapshotInvalidated({ reason: 'agent-added' });
      emitAgentUpdated({ agentId: 'b' });

      unsub();
      expect(seqs).toHaveLength(3);
      expect(seqs[1]).toBeGreaterThan(seqs[0]);
      expect(seqs[2]).toBeGreaterThan(seqs[1]);
    });
  });

  describe('getBufferedEventsSince', () => {
    it('returns events after the given sequence', () => {
      const seqBefore = getSequence();
      emitAgentUpdated({ agentId: 'x' });
      emitAgentUpdated({ agentId: 'y' });

      const events = getBufferedEventsSince(seqBefore);
      expect(events).not.toBeNull();
      expect(events!.length).toBeGreaterThanOrEqual(2);
      for (const e of events!) {
        expect(e.sequence).toBeGreaterThan(seqBefore);
      }
    });

    it('returns null for too-old since value', () => {
      // Emit enough to ensure buffer has events, then ask for something before the oldest
      emitAgentUpdated({ agentId: 'z' });
      const result = getBufferedEventsSince(-1);
      // -1 is before any event, and buffer has events, so oldest > -1 — should return null
      expect(result).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('unsubscribe stops receiving events', () => {
      const events: unknown[] = [];
      const unsub = subscribe((e) => events.push(e));

      emitAgentUpdated({ agentId: 'before' });
      unsub();
      emitAgentUpdated({ agentId: 'after' });

      expect(events).toHaveLength(1);
    });
  });
});
