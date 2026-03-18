import { NextResponse } from 'next/server';
import { getShortcutsTemplates } from '@/lib/jobs-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getShortcutsTemplates());
}
