import { NextRequest, NextResponse } from 'next/server';

const AREA_CODE_MAP: Record<string, string> = {
  '서울': '1', '인천': '2', '대전': '3', '대구': '4', '광주': '5',
  '부산': '6', '울산': '7', '세종': '8',
  '경기': '31', '강원': '32', '충북': '33', '충남': '34',
  '경북': '35', '경남': '36', '전북': '37', '전남': '38', '제주': '39',
  '경주': '35', '통영': '36', '거제': '36', '창원': '36',
  '전주': '37', '강릉': '32', '속초': '32', '여수': '38',
};

async function fetchDetail(base: string, key: string, contentId: string) {
  const common = new URLSearchParams({ serviceKey: key, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide', _type: 'json', contentId });
  const intro = new URLSearchParams({ ...Object.fromEntries(common), contentTypeId: '15' });

  const [commonRes, introRes] = await Promise.all([
    fetch(`${base}/detailCommon2?${common}`).then(r => r.text()).catch(() => '{}'),
    fetch(`${base}/detailIntro2?${intro}`).then(r => r.text()).catch(() => '{}'),
  ]);

  const commonItem = JSON.parse(commonRes)?.response?.body?.items?.item?.[0] ?? {};
  const introItem  = JSON.parse(introRes)?.response?.body?.items?.item?.[0] ?? {};

  return {
    overview:       commonItem.overview       ?? null,
    homepage:       commonItem.homepage       ?? null,
    tel:            commonItem.tel            ?? null,
    playtime:       introItem.playtime        ?? null,
    eventplace:     introItem.eventplace      ?? null,
    usetimefestival:introItem.usetimefestival ?? null,
    sponsor1:       introItem.sponsor1        ?? null,
    sponsor1tel:    introItem.sponsor1tel     ?? null,
  };
}

export async function GET(req: NextRequest) {
  const area = req.nextUrl.searchParams.get('area') ?? '';
  const areaCode = AREA_CODE_MAP[area];
  if (!areaCode) return NextResponse.json({ events: [], supported: false });

  const KEY = process.env.TOUR_API_KEY!;
  const BASE = process.env.TOUR_API_KR_BASE!;

  const qs = new URLSearchParams({
    serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide',
    _type: 'json', areaCode,
    eventStartDate: '20200101',
    numOfRows: '100',
  });

  try {
    const res = await fetch(`${BASE}/searchFestival2?${qs}`, { next: { revalidate: 3600 } });
    const data = JSON.parse(await res.text());
    const raw = data.response?.body?.items?.item ?? [];
    const all = Array.isArray(raw) ? raw : [raw];

    // 종료된 행사는 상세 fetch 생략 — 오늘 날짜 기준 필터
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const active = all.filter((e: { eventenddate?: string }) => (e.eventenddate ?? '') >= today);
    const ended  = all.filter((e: { eventenddate?: string }) => (e.eventenddate ?? '') <  today);

    const details = await Promise.all(active.map((e: { contentid: string }) => fetchDetail(BASE, KEY, e.contentid)));
    const enrichedActive = active.map((e: object, i: number) => ({ ...e, detail: details[i] }));
    const enrichedEnded  = ended.map((e: object) => ({ ...e, detail: {} }));

    return NextResponse.json({ events: [...enrichedActive, ...enrichedEnded], supported: true });
  } catch (e) {
    return NextResponse.json({ events: [], supported: true, error: String(e) }, { status: 500 });
  }
}
