import path from 'path';
import { existsSync } from 'fs';

export function resolveRepoRoot(): string {
  if (process.env.OPENCLAW_AGENTS) return process.env.OPENCLAW_AGENTS;

  let current = process.cwd();
  while (true) {
    if (
      existsSync(path.join(current, '.git')) &&
      existsSync(path.join(current, 'main')) &&
      existsSync(path.join(current, 'shared'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Could not resolve OpenClaw repo root. Set OPENCLAW_AGENTS explicitly.');
    }
    current = parent;
  }
}

export function resolveAgentsRoot(): string {
  return resolveRepoRoot();
}

export function resolveDashboardDataDir(): string {
  return path.join(resolveRepoRoot(), 'apps', 'dashboard', 'data');
}

export function resolveDashboardDataFile(filename: string): string {
  return path.join(resolveDashboardDataDir(), filename);
}
