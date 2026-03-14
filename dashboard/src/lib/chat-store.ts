import type { ChatRequest, ChatStatus } from './types';

const store = new Map<string, ChatRequest>();

function prune() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, req] of store) {
    if (new Date(req.startedAt).getTime() < cutoff) store.delete(id);
  }
}

export function createChat(agentId: string, userMessage: string): ChatRequest {
  prune();
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const req: ChatRequest = {
    id,
    agentId,
    userMessage,
    status: 'pending',
    startedAt: new Date().toISOString(),
  };
  store.set(id, req);
  return req;
}

export function getChat(chatId: string): ChatRequest | null {
  return store.get(chatId) ?? null;
}

export function updateChat(chatId: string, partial: Partial<ChatRequest>) {
  const req = store.get(chatId);
  if (!req) return;
  Object.assign(req, partial);
}

export function getRecentChats(agentId?: string, limit = 20): ChatRequest[] {
  const all = [...store.values()];
  const filtered = agentId ? all.filter((r) => r.agentId === agentId) : all;
  return filtered.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
}
