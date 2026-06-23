import { NextRequest, NextResponse } from 'next/server';
import { getAreaRows } from '@/lib/sheets';
import { getCachedAttractionsByArea, getCachedLocalRestaurantsByArea, getCachedTagRows, getCachedSectorRows, getCachedAreaRows } from '@/lib/cached-data';

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!process.env.REVALIDATE_SECRET || token !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const areas = await getAreaRows();
  const langs: ('ko' | 'en')[] = ['ko', 'en'];

  // 공통 캐시 먼저
  await Promise.all([getCachedTagRows(), getCachedSectorRows(), getCachedAreaRows()]);

  // 지역×언어 병렬 워밍업
  await Promise.all(
    areas.flatMap((a) =>
      langs.map(async (lang) => {
        await getCachedAttractionsByArea(a.area, lang);
        await getCachedLocalRestaurantsByArea(a.area, lang).catch(() => []);
      })
    )
  );

  return NextResponse.json({ warmed: true, areas: areas.map((a) => a.area) });
}
