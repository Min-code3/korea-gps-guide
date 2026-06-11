import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const contentId = req.nextUrl.searchParams.get('contentId');
  if (!contentId) return NextResponse.json({ error: 'contentId required' }, { status: 400 });

  const KEY = process.env.TOUR_API_KEY!;
  const BASE = process.env.TOUR_API_KR_BASE!;

  const qs = new URLSearchParams({
    serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide',
    _type: 'json', contentId, contentTypeId: '39',
  });

  try {
    const res = await fetch(`${BASE}/detailIntro2?${qs}`);
    const data = JSON.parse(await res.text());
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
