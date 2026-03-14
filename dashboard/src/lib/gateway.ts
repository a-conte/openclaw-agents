import type { HealthResponse } from './types';
import { runOpenClawJson } from './openclaw-cli';
import { createLogger } from './logger';

const log = createLogger('gateway');

export async function callGateway(method: string): Promise<unknown> {
  try {
    return await runOpenClawJson(['gateway', 'call', method, '--json'], { timeout: 10_000 });
  } catch (err: any) {
    log.error('Gateway call failed', { method, err: err.message });
    return null;
  }
}

export async function getHealth(): Promise<HealthResponse | null> {
  return callGateway('health') as Promise<HealthResponse | null>;
}
