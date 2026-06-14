import { NextRequest, NextResponse } from 'next/server';
import { translateBatch } from '@/lib/translate';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mapX = searchParams.get('mapX');
  const mapY = searchParams.get('mapY');
  const radius = searchParams.get('radius') ?? '1000';
  const contentTypeId = searchParams.get('contentTypeId') ?? '39';
  const lang = searchParams.get('lang') ?? 'ko';

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
      const items: { title?: string; [k: string]: unknown }[] = data?.response?.body?.items?.item ?? [];
      if (items.length) {
        const titles = items.map(r => r.title ?? '');
        const translated = await translateBatch(titles);
        items.forEach((r, i) => { r.title = translated[i] || r.title; });
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
