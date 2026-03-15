import { getBufferedEventsSince, subscribe } from '@/lib/mission-control-events';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get('since');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(data: string, event?: string) {
        if (event) controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      // Handle ?since= replay
      if (sinceParam != null) {
        const since = parseInt(sinceParam, 10);
        if (isNaN(since) || since < 0) {
          // Malformed — emit invalidation
          send(JSON.stringify({ reason: 'resume-gap' }), 'snapshot.invalidated');
        } else {
          const buffered = getBufferedEventsSince(since);
          if (buffered === null) {
            // Gap — too old
            send(JSON.stringify({ reason: 'resume-gap' }), 'snapshot.invalidated');
          } else {
            for (const event of buffered) {
              send(JSON.stringify(event), event.eventType);
            }
          }
        }
      }

      // Subscribe to live events
      const unsubscribe = subscribe((event) => {
        try {
          send(JSON.stringify(event), event.eventType);
        } catch {
          unsubscribe();
          controller.close();
        }
      });

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
