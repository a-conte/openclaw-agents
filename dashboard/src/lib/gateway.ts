import type { HealthResponse } from './types';
import { runOpenClawJson } from './openclaw-cli';

export async function callGateway(method: string): Promise<unknown> {
  try {
    return await runOpenClawJson(['gateway', 'call', method, '--json'], { timeout: 10_000 });
  } catch (err) {
    console.error(`Gateway call failed: ${method}`, err);
    return null;
  }
}

export async function getHealth(): Promise<HealthResponse | null> {
  return callGateway('health') as Promise<HealthResponse | null>;
}
