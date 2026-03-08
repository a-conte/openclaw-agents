import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/gateway';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await getHealth();
  if (!health) {
    return NextResponse.json({ ok: false, error: 'Gateway unreachable' }, { status: 503 });
  }
  return NextResponse.json(health);
}
