import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const contentId = req.nextUrl.searchParams.get('contentId');
  if (!contentId) return NextResponse.json({ images: [] });

  const KEY  = process.env.TOUR_API_KEY!;
  const BASE = process.env.TOUR_API_KR_BASE!;

  const qs = new URLSearchParams({
    serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide',
    _type: 'json', contentId, imageYN: 'Y', numOfRows: '20',
  });

  try {
    const res  = await fetch(`${BASE}/detailImage2?${qs}`, { cache: 'no-store' });
    const data = JSON.parse(await res.text());
    const raw  = data.response?.body?.items?.item ?? [];
    const arr  = Array.isArray(raw) ? raw : [raw];
    const images = arr
      .map((x: { originimgurl?: string }) => x.originimgurl ?? '')
      .filter(Boolean)
      .map((u: string) => u.replace(/^http:\/\//i, 'https://'));

    // 사진이 있을 때만 CDN 캐시 (빈 결과는 캐시하지 않아 재시도 가능)
    const headers = images.length
      ? { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' }
      : { 'Cache-Control': 'no-store' };
    return NextResponse.json({ images }, { headers });
  } catch {
    return NextResponse.json({ images: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
