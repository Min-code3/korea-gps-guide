import { NextRequest, NextResponse } from 'next/server';

const AREA_CODE_MAP: Record<string, string> = {
  '서울': '1', '인천': '2', '대전': '3', '대구': '4', '광주': '5',
  '부산': '6', '울산': '7', '세종': '8',
  '경기': '31', '강원': '32', '충북': '33', '충남': '34',
  '전북': '35', '전남': '36', '경북': '37', '경남': '38', '제주': '39',
  '경주': '37', '통영': '38', '거제': '38', '창원': '38',
  '전주': '35', '강릉': '32', '속초': '32', '여수': '36',
};

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
    const items = data.response?.body?.items?.item ?? [];
    return NextResponse.json({ events: Array.isArray(items) ? items : [items], supported: true });
  } catch (e) {
    return NextResponse.json({ events: [], supported: true, error: String(e) }, { status: 500 });
  }
}
