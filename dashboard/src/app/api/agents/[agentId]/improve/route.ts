import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readAgentFiles } from '@/lib/openclaw';

const execFileAsync = promisify(execFile);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const files = readAgentFiles(agentId);

  const currentFiles = Object.entries(files)
    .filter(([_, content]) => content)
    .map(([name, content]) => `### ${name}\n${(content as string).slice(0, 500)}...`)
    .join('\n\n');

  const message = `You are performing a self-improvement review. Your agent ID is "${agentId}".

Review your recent sessions and performance. Based on what you've learned, update your configuration files to become more effective.

Your current files:
${currentFiles}

Instructions:
1. Read your recent session logs from your sessions directory
2. Identify patterns: what tasks you handled well, what you struggled with, new skills or tools you used
3. Update your IDENTITY.md with refined self-description based on actual performance
4. Update your TOOLS.md with any new tools, commands, or techniques you've discovered
5. Update your MEMORY.md with key learnings and context that will help future sessions
6. Be specific and practical — add concrete commands, patterns, and tips you've actually used
7. Don't remove existing content that's still relevant — append and refine

Write the updated files using the write_file tool. Be concise but thorough.`;

  // Strip env vars that conflict with CLI
  const { OPENCLAW_AGENTS: _a, OPENCLAW_HOME: _h, ...cleanEnv } = process.env;

  try {
    // Fire and forget — don't await the full result, just confirm it started
    const proc = execFileAsync(
      '/usr/local/bin/openclaw',
      ['agent', '--agent', agentId, '--message', message, '--json'],
      {
        timeout: 600_000,
        encoding: 'utf-8',
        env: cleanEnv,
        cwd: process.env.HOME || '/Users/a_conte',
      }
    );

    // Wait briefly to confirm the process started
    await new Promise(resolve => setTimeout(resolve, 2000));

    return NextResponse.json({
      ok: true,
      message: `Self-improvement session started for ${agentId}. The agent is reviewing its sessions and updating its files.`,
    }, { status: 202 });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message || 'Failed to start improvement session',
    }, { status: 500 });
  }
}
