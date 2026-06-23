import { NextRequest, NextResponse } from 'next/server';
import { translateBatch } from '@/lib/translate';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mapX = searchParams.get('mapX');
  const mapY = searchParams.get('mapY');
  const radius = searchParams.get('radius') ?? '1000';
  const contentTypeId = searchParams.get('contentTypeId') ?? '39';
  const lang = searchParams.get('lang') ?? 'en';

  if (!mapX || !mapY) {
    return NextResponse.json({ error: 'mapX, mapY required' }, { status: 400 });
  }

  const KEY = process.env.TOUR_API_KEY!;
  const BASE = process.env.TOUR_API_KR_BASE!;

  const qs = new URLSearchParams({
    serviceKey: KEY,
    MobileOS: 'ETC',
    MobileApp: 'KoreaGpsGuide',
    _type: 'json',
    mapX,
    mapY,
    radius,
    contentTypeId,
    numOfRows: '20',
    arrange: 'E', // 거리순 정렬
  });

  try {
    const res = await fetch(`${BASE}/locationBasedList2?${qs}`);
    const data = JSON.parse(await res.text());

    if (lang === 'en') {
      const items: { title?: string; addr1?: string; [k: string]: unknown }[] = data?.response?.body?.items?.item ?? [];
      if (items.length) {
        const titles = items.map(r => r.title ?? '');
        const addrs  = items.map(r => r.addr1  ?? '');
        const [tTitles, tAddrs] = await Promise.all([
          translateBatch(titles),
          translateBatch(addrs),
        ]);
        items.forEach((r, i) => {
          r.title = tTitles[i] || r.title;
          r.addr1 = tAddrs[i]  || r.addr1;
        });
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
