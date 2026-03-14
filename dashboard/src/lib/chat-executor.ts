import { updateChat } from './chat-store';
import { runOpenClaw } from './openclaw-cli';

export async function executeChatInBackground(chatId: string, agentId: string, message: string): Promise<void> {
  try {
    const { stdout } = await runOpenClaw(
      ['agent', '--agent', agentId, '--message', message, '--json'],
      { timeout: 120_000 },
    );

    let response = stdout.trim();

    // Try to extract the response text from JSON output
    try {
      const parsed = JSON.parse(response);
      response = parsed.response || parsed.content || parsed.text || parsed.result || response;
      if (typeof response !== 'string') response = JSON.stringify(response, null, 2);
    } catch {
      // Not JSON — use raw stdout
    }

    updateChat(chatId, { status: 'done', response, completedAt: new Date().toISOString() });
  } catch (err: any) {
    updateChat(chatId, {
      status: 'failed',
      error: err.stderr || err.message || 'Unknown error',
      completedAt: new Date().toISOString(),
    });
  }
}
