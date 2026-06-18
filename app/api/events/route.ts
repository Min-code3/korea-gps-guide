import { NextRequest, NextResponse } from 'next/server';
import { getEventOverrides } from '@/lib/sheets';
import { translateBatch } from '@/lib/translate';

// areaCode 쿼리 대신 전국 fetch 후 addr1 키워드로 필터
// — areacode가 누락된 행사(TourAPI 데이터 품질 이슈)도 잡기 위함
const ADDR1_KEYWORD_MAP: Record<string, string> = {
  '서울': '서울', '인천': '인천', '대전': '대전', '대구': '대구', '광주': '광주',
  '부산': '부산', '울산': '울산', '세종': '세종',
  '경기': '경기', '강원': '강원', '충북': '충청북', '충남': '충청남',
  '경북': '경상북', '경남': '경상남', '전북': '전북', '전남': '전라남', '제주': '제주',
  '경주': '경주', '통영': '통영', '거제': '거제', '창원': '창원',
  '전주': '전주', '강릉': '강릉', '속초': '속초', '여수': '여수',
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
    overview:        commonItem.overview        ?? null,
    homepage:        commonItem.homepage        ?? null,
    tel:             commonItem.tel             ?? null,
    playtime:        introItem.playtime         ?? null,
    eventplace:      introItem.eventplace       ?? null,
    usetimefestival: introItem.usetimefestival  ?? null,
    sponsor1:        introItem.sponsor1         ?? null,
    sponsor1tel:     introItem.sponsor1tel      ?? null,
  };
}

export async function GET(req: NextRequest) {
  const area = req.nextUrl.searchParams.get('area') ?? '';
  const lang = req.nextUrl.searchParams.get('lang') ?? 'ko';

  const keyword = ADDR1_KEYWORD_MAP[area];
  if (!keyword) return NextResponse.json({ events: [], supported: false });

  const KEY  = process.env.TOUR_API_KEY!;
  const BASE = process.env.TOUR_API_KR_BASE!;  // 언어 무관하게 한국어 API 고정 (사진/식당과 동일)

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const d90ago = new Date(); d90ago.setDate(d90ago.getDate() - 90);
  const fetchFrom = d90ago.toISOString().slice(0, 10).replace(/-/g, '');

  const d7later = new Date(); d7later.setDate(d7later.getDate() + 7);
  const sevenDaysLater = d7later.toISOString().slice(0, 10).replace(/-/g, '');

  const qs = new URLSearchParams({
    serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide',
    _type: 'json',
    eventStartDate: fetchFrom,  // 90일 전부터 → 진행 중인 행사 포함
    numOfRows: '500',
  });

  try {
    const [festivalRes, overrides] = await Promise.all([
      fetch(`${BASE}/searchFestival2?${qs}`, { next: { revalidate: 3600 } }),
      getEventOverrides(),
    ]);
    const data = JSON.parse(await festivalRes.text());
    const raw = data.response?.body?.items?.item ?? [];
    const all = Array.isArray(raw) ? raw : [raw];

    const overrideMap = Object.fromEntries(overrides.map((o) => [o.contentId, o.note]));

    // addr1 기준으로 해당 지역 행사만 필터
    const areaFiltered = all.filter((e: { addr1?: string }) => (e.addr1 ?? '').includes(keyword));

    // 진행 중 + 7일 이내 시작 예정만 표시 (이미 끝났거나 너무 먼 미래는 제외)
    type EventRaw = { contentid: string; title?: string; [k: string]: unknown };
    const active = areaFiltered.filter((e: { eventstartdate?: string; eventenddate?: string }) =>
      (e.eventenddate ?? '') >= today && (e.eventstartdate ?? '') <= sevenDaysLater
    );

    // event_overrides에 있지만 일반 조회에서 누락된 행사 직접 fetch
    // (searchFestival2의 eventStartDate 범위보다 일찍 시작된 장기 행사 보완)
    const activeIds = new Set(active.map((e: EventRaw) => e.contentid));
    const missingOverrides = overrides.filter(o => !activeIds.has(o.contentId) && o.area === area);
    const extraEvents: EventRaw[] = (await Promise.all(
      missingOverrides.map(async (o) => {
        const p  = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide', _type: 'json', contentId: o.contentId });
        const pi = new URLSearchParams({ ...Object.fromEntries(p), contentTypeId: '15' });
        const [cText, dText] = await Promise.all([
          fetch(`${BASE}/detailCommon2?${p}`).then(r => r.text()).catch(() => '{}'),
          fetch(`${BASE}/detailIntro2?${pi}`).then(r => r.text()).catch(() => '{}'),
        ]);
        const c = JSON.parse(cText)?.response?.body?.items?.item?.[0] ?? {};
        const d = JSON.parse(dText)?.response?.body?.items?.item?.[0] ?? {};
        if ((d.eventenddate ?? '') && (d.eventenddate as string) < today) return null;
        return {
          contentid: o.contentId,
          title: c.title ?? '',
          addr1: c.addr1 ?? '',
          firstimage: c.firstimage ?? '',
          eventstartdate: d.eventstartdate ?? '',
          eventenddate: d.eventenddate ?? '',
        } as EventRaw;
      })
    )).filter((e): e is EventRaw => e !== null);

    const allActive: EventRaw[] = [...(active as EventRaw[]), ...extraEvents];

    const details = await Promise.all(allActive.map(e => fetchDetail(BASE, KEY, e.contentid)));

    // 영어 모드: 제목·장소·운영시간·요금 한꺼번에 번역 (배치 1회 호출)
    let enrichedActive: object[];
    if (lang === 'en') {
      const titles     = allActive.map(e => e.title ?? '');
      const places     = details.map(d => d.eventplace ?? '');
      const playtimes  = details.map(d => d.playtime ?? '');
      const fees       = details.map(d => d.usetimefestival ?? '');

      const [tTitles, tPlaces, tPlaytimes, tFees] = await Promise.all([
        translateBatch(titles),
        translateBatch(places),
        translateBatch(playtimes),
        translateBatch(fees),
      ]);

      enrichedActive = allActive.map((e: EventRaw, i: number) => ({
        ...e,
        title: tTitles[i] || e.title,
        detail: {
          ...details[i],
          eventplace:      tPlaces[i]    || details[i].eventplace,
          playtime:        tPlaytimes[i] || details[i].playtime,
          usetimefestival: tFees[i]      || details[i].usetimefestival,
        },
        customNote: overrideMap[e.contentid] ?? null,
      }));
    } else {
      enrichedActive = allActive.map((e: EventRaw, i: number) => ({
        ...e, detail: details[i], customNote: overrideMap[e.contentid] ?? null,
      }));
    }

    return NextResponse.json({ events: enrichedActive, supported: true });
  } catch (e) {
    return NextResponse.json({ events: [], supported: true, error: String(e) }, { status: 500 });
  }
}
