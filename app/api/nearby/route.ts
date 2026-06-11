import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mapX = searchParams.get('mapX');
  const mapY = searchParams.get('mapY');
  const radius = searchParams.get('radius') ?? '1000';
  const contentTypeId = searchParams.get('contentTypeId') ?? '39';

  if (!mapX || !mapY) {
    return NextResponse.json({ error: 'mapX, mapY required' }, { status: 400 });
  }

  const lang = searchParams.get('lang') ?? 'ko';
  const KEY = process.env.TOUR_API_KEY!;
  const BASE = lang === 'en' ? process.env.TOUR_API_ENG_BASE! : process.env.TOUR_API_KR_BASE!;

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
    const text = await res.text();
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
