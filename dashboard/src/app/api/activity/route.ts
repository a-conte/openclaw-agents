import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/gateway';
import { AGENT_EMOJIS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface ActivityEvent {
  id: string;
  agentId: string;
  emoji: string;
  message: string;
  timestamp: number;
  type: 'heartbeat' | 'session' | 'status';
}

export async function GET() {
  const health = await getHealth();
  if (!health) {
    return NextResponse.json([]);
  }

  const events: ActivityEvent[] = [];

  for (const agent of health.agents) {
    for (const session of agent.sessions.recent) {
      const ageName = formatAge(session.age);
      const isHeartbeat = session.key.includes('heartbeat') || session.key.includes(':main');

      events.push({
        id: `${agent.agentId}-${session.key}`,
        agentId: agent.agentId,
        emoji: AGENT_EMOJIS[agent.agentId] || '🤖',
        message: isHeartbeat
          ? `${agent.agentId} completed heartbeat`
          : `${agent.agentId} session active`,
        timestamp: session.updatedAt,
        type: isHeartbeat ? 'heartbeat' : 'session',
      });
    }
  }

  events.sort((a, b) => b.timestamp - a.timestamp);
  return NextResponse.json(events.slice(0, 20));
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
