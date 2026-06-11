import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const contentId = req.nextUrl.searchParams.get('contentId');
  if (!contentId) return NextResponse.json({ error: 'contentId required' }, { status: 400 });

  const KEY = process.env.TOUR_API_KEY!;
  const BASE = process.env.TOUR_API_KR_BASE!;

  const qs = new URLSearchParams({
    serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide',
    _type: 'json', contentId,
  });

  try {
    const res = await fetch(`${BASE}/detailCommon2?${qs}`);
    const data = JSON.parse(await res.text());
    const item = data.response?.body?.items?.item?.[0] ?? {};
    return NextResponse.json({
      overview: item.overview ?? null,
      homepage: item.homepage ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
