import { NextRequest } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { getCached } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || `${process.env.HOME}/.openclaw`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('mode') || 'snapshot';

  if (mode === 'stream') {
    return streamLogs();
  }

  return snapshotLogs(searchParams.get('lines') || '100');
}

function snapshotLogs(linesParam: string) {
  const maxLines = Math.min(parseInt(linesParam) || 100, 500);

  const loadSnapshot = () => {
    const logFiles = [
      { name: 'stdout', path: path.join(OPENCLAW_HOME, 'logs', 'gateway-stdout.log') },
      { name: 'stderr', path: path.join(OPENCLAW_HOME, 'logs', 'gateway-stderr.log') },
    ];

    const logs: Array<{ source: string; line: string; timestamp?: number }> = [];
    for (const logFile of logFiles) {
      if (!existsSync(logFile.path)) continue;
      try {
        const content = readFileSync(logFile.path, 'utf-8');
        const lines = content.split('\n').filter(Boolean).slice(-maxLines);
        for (const line of lines) logs.push({ source: logFile.name, line });
      } catch {
        // ignore log read error
      }
    }
    return { logs, count: logs.length };
  };

  return getCached(`logs-snapshot-${maxLines}`, { ttlMs: 2000, staleMs: 4000 }, loadSnapshot).then((payload) => new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

function streamLogs() {
  const logPath = path.join(OPENCLAW_HOME, 'logs', 'gateway-stdout.log');

  if (!existsSync(logPath)) {
    return new Response(JSON.stringify({ error: 'Log file not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let lastSize = 0;

  try {
    lastSize = statSync(logPath).size;
  } catch {}

  const stream = new ReadableStream({
    start(controller) {
      // Send initial batch
      try {
        const content = readFileSync(logPath, 'utf-8');
        const lines = content.split('\n').filter(Boolean).slice(-50);
        for (const line of lines) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line, source: 'stdout' })}\n\n`));
        }
      } catch {}

      // Poll for new content
      const interval = setInterval(() => {
        try {
          const stat = statSync(logPath);
          if (stat.size > lastSize) {
            const content = readFileSync(logPath, 'utf-8');
            const allLines = content.split('\n').filter(Boolean);
            // Approximate: send lines that are new
            const newLines = allLines.slice(-(stat.size - lastSize > 1000 ? 50 : 10));
            for (const line of newLines) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ line, source: 'stdout' })}\n\n`));
            }
            lastSize = stat.size;
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 2000);

      // Clean up after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 5 * 60 * 1000);
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
