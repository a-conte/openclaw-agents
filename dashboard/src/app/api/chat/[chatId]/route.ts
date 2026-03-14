import { NextResponse } from 'next/server';
import { getChat } from '@/lib/chat-store';

export async function GET(_request: Request, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const chat = getChat(chatId);

  if (!chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  return NextResponse.json(chat);
}
