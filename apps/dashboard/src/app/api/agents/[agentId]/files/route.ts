import { NextResponse } from 'next/server';
import { writeAgentFile, readAgentFiles } from '@/lib/openclaw';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const { filename, content } = await request.json();

  const allowlist = ['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'HEARTBEAT.md', 'MEMORY.md'];
  if (!allowlist.includes(filename)) {
    return NextResponse.json({ error: 'File not allowed' }, { status: 400 });
  }

  const success = writeAgentFile(agentId, filename, content);
  if (!success) {
    return NextResponse.json({ error: 'Write failed' }, { status: 500 });
  }

  const files = readAgentFiles(agentId);
  return NextResponse.json({ content: files[filename] });
}
