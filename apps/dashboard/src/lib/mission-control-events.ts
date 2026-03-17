import type {
  EventEnvelopeContract,
  JobContract,
  MissionControlAgentUpdatedContract,
  MissionControlSnapshotInvalidatedContract,
} from '@openclaw/contracts';
import { randomUUID } from 'crypto';
import { nextSequence, getSequence } from './mission-control';

const MAX_BUFFER_SIZE = 200;
const eventBuffer: EventEnvelopeContract[] = [];
const listeners = new Set<(event: EventEnvelopeContract) => void>();

function createEnvelope(
  eventType: string,
  entityId: string,
  payload: Record<string, unknown>,
): EventEnvelopeContract {
  const envelope: EventEnvelopeContract = {
    eventId: `evt-${randomUUID()}`,
    sequence: nextSequence(),
    eventType,
    entityId,
    emittedAt: new Date().toISOString(),
    payload,
  };
  eventBuffer.push(envelope);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.splice(0, eventBuffer.length - MAX_BUFFER_SIZE);
  }
  for (const listener of listeners) {
    listener(envelope);
  }
  return envelope;
}

export function emitAgentUpdated(payload: MissionControlAgentUpdatedContract): void {
  createEnvelope('agent.updated', payload.agentId, payload as unknown as Record<string, unknown>);
}

export function emitJobUpdated(payload: JobContract): void {
  createEnvelope('job.updated', payload.id, payload as unknown as Record<string, unknown>);
}

export function emitSnapshotInvalidated(
  payload: MissionControlSnapshotInvalidatedContract,
): void {
  createEnvelope('snapshot.invalidated', 'mission-control', payload as unknown as Record<string, unknown>);
}

export function getBufferedEventsSince(since: number): EventEnvelopeContract[] | null {
  if (eventBuffer.length === 0) {
    // No events in buffer — if since matches current sequence, treat as resumable
    if (since === getSequence()) return [];
    return null;
  }
  const oldest = eventBuffer[0].sequence;
  if (since < oldest) return null; // too old, gap
  return eventBuffer.filter((e) => e.sequence > since);
}

export function subscribe(listener: (event: EventEnvelopeContract) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
