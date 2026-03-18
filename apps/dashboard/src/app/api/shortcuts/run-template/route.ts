import { NextResponse } from 'next/server';
import { runShortcutTemplate } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let data: any;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const templateId = typeof data.templateId === 'string' ? data.templateId.trim() : '';
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
  }
  const templateInputs = typeof data.templateInputs === 'object' && data.templateInputs !== null && !Array.isArray(data.templateInputs)
    ? Object.fromEntries(Object.entries(data.templateInputs).map(([key, value]) => [key, String(value)]))
    : {};
  try {
    return NextResponse.json(await runShortcutTemplate({
      templateId,
      templateInputs,
      targetAgent: typeof data.targetAgent === 'string' ? data.targetAgent : 'main',
      wait: data.wait !== false,
      timeout: typeof data.timeout === 'number' ? data.timeout : undefined,
      pollInterval: typeof data.pollInterval === 'number' ? data.pollInterval : undefined,
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run shortcut template' },
      { status: 400 },
    );
  }
}
