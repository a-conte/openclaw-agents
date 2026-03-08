import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import type { Session, SessionMessage } from './types';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;

// Resolve agents root: env var > sibling of dashboard > ~/openclaw-agents
function resolveAgentsRoot(): string {
  if (process.env.OPENCLAW_AGENTS) return process.env.OPENCLAW_AGENTS;
  // dashboard lives inside the openclaw-agents repo — cwd is the dashboard dir
  const fromCwd = path.resolve(process.cwd(), '..');
  if (existsSync(path.join(fromCwd, 'main')) || existsSync(path.join(fromCwd, 'dashboard'))) {
    return fromCwd;
  }
  return `${process.env.HOME}/openclaw-agents`;
}
const OPENCLAW_AGENTS = resolveAgentsRoot();

export function readConfig() {
  const configPath = path.join(OPENCLAW_HOME, 'openclaw.json');
  if (!existsSync(configPath)) return null;
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  // Strip sensitive fields
  if (raw.auth) delete raw.auth;
  if (raw.tools?.web?.search?.apiKey) raw.tools.web.search.apiKey = '[REDACTED]';
  if (raw.bindings) {
    raw.bindings = raw.bindings.map((b: Record<string, unknown>) => {
      const clean = { ...b };
      if (clean.token) clean.token = '[REDACTED]';
      if (clean.apiKey) clean.apiKey = '[REDACTED]';
      return clean;
    });
  }
  return raw;
}

export function readAgentFiles(agentId: string): Record<string, string> {
  const agentDir = path.join(OPENCLAW_AGENTS, agentId);
  const files: Record<string, string> = {};
  const filenames = ['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md', 'USER.md', 'AGENTS.md'];
  for (const fname of filenames) {
    const fpath = path.join(agentDir, fname);
    if (existsSync(fpath)) {
      files[fname] = readFileSync(fpath, 'utf-8');
    }
  }
  return files;
}

export function writeAgentFile(agentId: string, filename: string, content: string): boolean {
  const allowlist = ['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md'];
  if (!allowlist.includes(filename)) return false;
  const fpath = path.join(OPENCLAW_AGENTS, agentId, filename);
  const { writeFileSync } = require('fs');
  writeFileSync(fpath, content, 'utf-8');
  return true;
}

export function readSessions(agentId: string): Record<string, Session> {
  const sessionsPath = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions', 'sessions.json');
  if (!existsSync(sessionsPath)) return {};
  return JSON.parse(readFileSync(sessionsPath, 'utf-8'));
}

export function readSessionMessages(
  agentId: string,
  sessionId: string,
  offset: number = 0,
  limit: number = 50
): { messages: SessionMessage[]; total: number } {
  const sessionsDir = path.join(OPENCLAW_HOME, 'agents', agentId, 'sessions');
  const sessionFile = path.join(sessionsDir, `${sessionId}.jsonl`);
  if (!existsSync(sessionFile)) return { messages: [], total: 0 };

  const lines = readFileSync(sessionFile, 'utf-8').split('\n').filter(Boolean);
  const allMessages: SessionMessage[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'message' && parsed.message) {
        allMessages.push(parsed);
      }
    } catch {}
  }

  return {
    messages: allMessages.slice(offset, offset + limit),
    total: allMessages.length,
  };
}

export function getAgentIds(): string[] {
  const agentsDir = path.join(OPENCLAW_AGENTS);
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !['dashboard', 'scripts', 'shared'].includes(d.name))
    .map(d => d.name);
}
