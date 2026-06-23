import { NextRequest, NextResponse } from 'next/server';
import { clearAreaContentCache } from '@/lib/cached-data';

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!process.env.REVALIDATE_SECRET || token !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const deleted = await clearAreaContentCache();
  return NextResponse.json({ revalidated: true, deleted });
}
