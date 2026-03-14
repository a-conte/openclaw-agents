import { updateChat } from './chat-store';
import { runOpenClaw } from './openclaw-cli';

export function extractResponse(stdout: string): string {
  let response = stdout.trim();

  try {
    const parsed = JSON.parse(response);

    // Find payloads — could be at top level or nested under result
    const payloads = parsed.payloads || parsed.result?.payloads;

    if (payloads && Array.isArray(payloads)) {
      const texts = payloads
        .map((p: any) => p.text)
        .filter(Boolean);
      if (texts.length > 0) return texts.join('\n\n');
    }

    if (typeof parsed.response === 'string') return parsed.response;
    if (typeof parsed.content === 'string') return parsed.content;
    if (typeof parsed.text === 'string') return parsed.text;
    if (typeof parsed.result === 'string') return parsed.result;
  } catch {
    // Not JSON — use raw stdout
  }

  return response;
}

export async function executeChatInBackground(chatId: string, agentId: string, message: string): Promise<void> {
  try {
    const { stdout } = await runOpenClaw(
      ['agent', '--agent', agentId, '--message', message, '--json'],
      { timeout: 120_000 },
    );

    const response = extractResponse(stdout);
    updateChat(chatId, { status: 'done', response, completedAt: new Date().toISOString() });
  } catch (err: any) {
    updateChat(chatId, {
      status: 'failed',
      error: err.stderr || err.message || 'Unknown error',
      completedAt: new Date().toISOString(),
    });
  }
}
