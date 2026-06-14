import { NextRequest, NextResponse } from 'next/server';
import { translateBatch } from '@/lib/translate';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const contentId = searchParams.get('contentId');
  const lang = searchParams.get('lang') ?? 'ko';
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

    if (lang === 'en') {
      const item: { firstmenu?: string; treatmenu?: string; [k: string]: unknown } =
        data?.response?.body?.items?.item?.[0] ?? {};
      const [first, treat] = await translateBatch([item.firstmenu, item.treatmenu]);
      if (first) item.firstmenu = first;
      if (treat) item.treatmenu = treat;
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
