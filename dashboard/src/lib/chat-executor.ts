import { updateChat } from './chat-store';
import { runOpenClaw } from './openclaw-cli';

export async function executeChatInBackground(chatId: string, agentId: string, message: string): Promise<void> {
  try {
    const { stdout } = await runOpenClaw(
      ['agent', '--agent', agentId, '--message', message, '--json'],
      { timeout: 120_000 },
    );

    let response = stdout.trim();

    // Extract the response text from OpenClaw's JSON output
    try {
      const parsed = JSON.parse(response);

      // OpenClaw wraps agent replies in { payloads: [{ text, mediaUrl }], meta: {...} }
      if (parsed.payloads && Array.isArray(parsed.payloads)) {
        const texts = parsed.payloads
          .map((p: any) => p.text)
          .filter(Boolean);
        response = texts.join('\n\n') || response;
      } else {
        response = parsed.response || parsed.content || parsed.text || parsed.result || response;
      }

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
