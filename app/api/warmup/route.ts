import { NextRequest, NextResponse } from 'next/server';
import { getAreaRows } from '@/lib/sheets';
import { getCachedAttractionsByArea, getCachedLocalRestaurantsByArea, getCachedTagRows, getCachedSectorRows, getCachedAreaRows, getCachedAreaCoverImages } from '@/lib/cached-data';

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!process.env.REVALIDATE_SECRET || token !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const areas = await getAreaRows();
  const langs: ('ko' | 'en')[] = ['ko', 'en'];

  // 공통 캐시 먼저 (커버 이미지는 내부에서 이미 동시 호출 제한 처리됨)
  await Promise.all([getCachedTagRows(), getCachedSectorRows(), getCachedAreaRows(), getCachedAreaCoverImages()]);

  // 지역×언어 순차 워밍업 — 한꺼번에 병렬로 쏘면 TourAPI rate limit에 걸려
  // 일부 명소가 실패하고, 그 실패가 그대로 캐싱되는 문제가 있었음.
  // 한 묶음씩 처리 + 짧은 대기로 동시 호출량을 줄인다.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const a of areas) {
    for (const lang of langs) {
      await getCachedAttractionsByArea(a.area, lang);
      await getCachedLocalRestaurantsByArea(a.area, lang).catch(() => []);
      await sleep(2000);
    }
  }

  return NextResponse.json({ warmed: true, areas: areas.map((a) => a.area) });
}
