import { ACTIVE_AGENT_IDS } from '@/lib/constants';
import { extractResponse } from '@/lib/chat-executor';
import { runOpenClaw } from '@/lib/openclaw-cli';

export async function POST(request: Request) {
  const { agentId, message } = await request.json();

  if (!agentId || !message) {
    return new Response(JSON.stringify({ error: 'agentId and message are required' }), { status: 400 });
  }

  if (!(ACTIVE_AGENT_IDS as readonly string[]).includes(agentId)) {
    return new Response(JSON.stringify({ error: `Unknown agent: ${agentId}` }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send a heartbeat so the client knows the connection is alive
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'pending' })}\n\n`));

      try {
        const { stdout } = await runOpenClaw(
          ['agent', '--agent', agentId, '--message', message, '--json'],
          { timeout: 120_000 },
        );

        const response = extractResponse(stdout);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'done', response })}\n\n`));
      } catch (err: any) {
        const error = err.stderr || err.message || 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'failed', error })}\n\n`));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
