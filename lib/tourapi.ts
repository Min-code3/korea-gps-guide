const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&apos;': "'", '&rsquo;': '’', '&lsquo;': '‘',
  '&rdquo;': '”', '&ldquo;': '“', '&ndash;': '–', '&mdash;': '—',
  '&hellip;': '...', '&bull;': '•', '&middot;': '·',
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, (e) => HTML_ENTITIES[e] ?? e)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const BASE = process.env.TOUR_API_KR_BASE!;
const ENG_BASE = process.env.TOUR_API_ENG_BASE!;
const KEY = process.env.TOUR_API_KEY!;

interface TourAPIBasic {
  title: string;
  overview: string;
  mapy: string;
  mapx: string;
  firstimage: string;
}

interface TourAPIIntro {
  usetime: string;
  restdate: string;
}

interface TourAPIInfo {
  infoname: string;
  infotext: string;
}

export interface TourAPIAttraction {
  name: string;
  description: string;
  center: { lat: number; lng: number };
  hours: string;
  admission: string;
  image: string;
}

async function fetchJSON(base: string, endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ serviceKey: KEY, MobileOS: 'ETC', MobileApp: 'KoreaGpsGuide', _type: 'json', ...params });
  const res = await fetch(`${base}/${endpoint}?${qs}`, { next: { revalidate: 3600 } });
  const text = await res.text();
  let data: ReturnType<typeof JSON.parse>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`TourAPI error (${endpoint}): ${text.slice(0, 200)}`);
  }
  const code = data?.response?.header?.resultCode;
  if (code && code !== '0000') {
    throw new Error(`TourAPI ${endpoint} resultCode ${code}: ${data?.response?.header?.resultMsg}`);
  }
  return data;
}

// 목록 뷰용 — detailCommon2만 호출 (name/image/coords만 필요)
export async function getAttractionBasicFromAPI(contentId: string): Promise<TourAPIAttraction> {

  const common = await fetchJSON(BASE, 'detailCommon2', { contentId, overviewYN: 'Y' });
  const c: TourAPIBasic = common.response?.body?.items?.item?.[0];
  if (!c) throw new Error(`TourAPI: contentId ${contentId} not found`);

  return {
    name: c.title,
    description: stripHtml(c.overview ?? ''),
    center: { lat: parseFloat(c.mapy), lng: parseFloat(c.mapx) },
    hours: '',
    admission: '',
    image: c.firstimage ?? '',
  };
}

// 가이드 상세용 — 영업시간/입장료까지 포함
export async function getAttractionFromAPI(contentId: string, contentTypeId = '12'): Promise<TourAPIAttraction> {

  const [common, intro, info] = await Promise.all([
    fetchJSON(BASE, 'detailCommon2', { contentId, overviewYN: 'Y' }),
    fetchJSON(BASE, 'detailIntro2', { contentId, contentTypeId }),
    fetchJSON(BASE, 'detailInfo2', { contentId, contentTypeId }),
  ]);

  const c: TourAPIBasic = common.response?.body?.items?.item?.[0];
  if (!c) throw new Error(`TourAPI: contentId ${contentId} not found`);
  const i: TourAPIIntro = intro.response?.body?.items?.item?.[0] ?? {};
  const infoItems: TourAPIInfo[] = info.response?.body?.items?.item ?? [];

  const admissionItem = infoItems.find((x) => x.infoname === '입장료');

  return {
    name: c.title,
    description: stripHtml(c.overview ?? ''),
    center: { lat: parseFloat(c.mapy), lng: parseFloat(c.mapx) },
    hours: stripHtml(i.usetime ?? ''),
    admission: stripHtml(admissionItem?.infotext ?? ''),
    image: c.firstimage ?? '',
  };
}

export async function getAttractionFromEngAPI(contentId: string): Promise<TourAPIAttraction> {

  const [common, intro] = await Promise.all([
    fetchJSON(ENG_BASE, 'detailCommon2', { contentId, overviewYN: 'Y' }),
    fetchJSON(ENG_BASE, 'detailIntro2', { contentId, contentTypeId: '76' }),
  ]);

  const c: TourAPIBasic = common.response?.body?.items?.item?.[0];
  if (!c) throw new Error(`TourAPI ENG: contentId ${contentId} not found`);
  const i: TourAPIIntro = intro.response?.body?.items?.item?.[0] ?? {};

  return {
    name: c.title.replace(/\s*\(.*?\)\s*$/, ''),
    description: stripHtml(c.overview ?? ''),
    center: { lat: parseFloat(c.mapy), lng: parseFloat(c.mapx) },
    hours: stripHtml(i.usetime ?? ''),
    admission: '',
    image: c.firstimage ?? '',
  };
}

export async function getAttractionImages(contentId: string): Promise<string[]> {

  const data = await fetchJSON(BASE, 'detailImage2', { contentId, imageYN: 'Y', numOfRows: '20' });
  const items = data.response?.body?.items?.item ?? [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.map((x: { originimgurl?: string }) => x.originimgurl).filter(Boolean) as string[];
}
