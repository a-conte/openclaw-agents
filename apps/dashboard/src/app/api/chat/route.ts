import { NextResponse } from 'next/server';
import { createChat, getRecentChats } from '@/lib/chat-store';
import { executeChatInBackground } from '@/lib/chat-executor';
import { ACTIVE_AGENT_IDS } from '@/lib/constants';

export async function POST(request: Request) {
  const body = await request.json();
  const { agentId, message } = body;

  if (!agentId || !message) {
    return NextResponse.json({ error: 'agentId and message are required' }, { status: 400 });
  }

  if (!(ACTIVE_AGENT_IDS as readonly string[]).includes(agentId)) {
    return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });
  }

  const chat = createChat(agentId, message);

  // Fire and forget
  executeChatInBackground(chat.id, agentId, message);

  return NextResponse.json({ chatId: chat.id, status: 'pending' }, { status: 202 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId') || undefined;
  const chats = getRecentChats(agentId);
  return NextResponse.json({ chats });
}
