import { exec } from 'child_process';
import { promisify } from 'util';
import type { HealthResponse } from './types';

const execAsync = promisify(exec);

export async function callGateway(method: string): Promise<unknown> {
  try {
    const { stdout } = await execAsync(`openclaw gateway call ${method} --json`, {
      timeout: 10000,
      encoding: 'utf-8',
      env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: process.env.GATEWAY_TOKEN },
    });
    return JSON.parse(stdout);
  } catch (err) {
    console.error(`Gateway call failed: ${method}`, err);
    return null;
  }
}

export async function getHealth(): Promise<HealthResponse | null> {
  return callGateway('health') as Promise<HealthResponse | null>;
}
