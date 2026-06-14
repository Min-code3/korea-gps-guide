import { Attraction } from '@/lib/types';
import { getAreaRows, getAttractionRows, getPinpointRows, AreaRow } from '@/lib/sheets';
import { getAttractionBasicFromAPI, getAttractionFromAPI, getAttractionFromEngAPI, getAttractionImages } from '@/lib/tourapi';

function toHttps(url: string) {
  return url.replace(/^http:\/\//i, 'https://');
}

type Lang = 'ko' | 'en';

function buildAttraction(
  row: Awaited<ReturnType<typeof getAttractionRows>>[number],
  pinpoints: Awaited<ReturnType<typeof getPinpointRows>>,
  apiData: Awaited<ReturnType<typeof getAttractionFromAPI>>,
  images: string[],
  sheetCenter?: { lat: number; lng: number },
): Attraction {
  const myPins = pinpoints.filter((p) => p.attractionName === row.name);

  const aBlocks = myPins
    .filter((p) => p.type === 'A')
    .map((p) => ({ id: p.id, src: p.audioSrc, title: p.audioTitle || undefined }));

  const pins = myPins
    .filter((p) => p.type !== 'A')
    .map((p) => ({
      id: p.id,
      name: p.pinName,
      lat: p.lat,
      lng: p.lng,
      radius: p.radius,
      pinType: p.type === 'P' ? ('photo' as const) : ('spot' as const),
      autoPlay: p.autoplay,
      routeOrder: p.routeOrder,
      isMainRoute: p.isMainRoute,
      bBlock: p.audioSrc ? { id: p.id + '-b', src: p.audioSrc, title: p.audioTitle || undefined } : undefined,
    }));

  // 시트 좌표 우선, 없으면 TourAPI 좌표 사용
  const center = sheetCenter ?? apiData.center;

  return {
    id: row.id,
    contentId: row.korContentId || undefined,
    name: apiData.name || row.name,
    sector: row.sector || undefined,
    description: apiData.description,
    center,
    hours: apiData.hours,
    admission: row.admission || apiData.admission,
    defaultZoom: row.defaultZoom,
    star: row.star || undefined,
    tags: row.tags,
    images,
    aBlocks,
    pins,
  };
}

const FALLBACK_API: Awaited<ReturnType<typeof getAttractionFromAPI>> = {
  name: '', description: '', center: { lat: 0, lng: 0 }, hours: '', admission: '', image: '',
};

async function fetchAPIData(
  row: { korContentId: string; engContentId: string; name: string },
  lang: Lang,
  light = false,
) {
  const fallback = { ...FALLBACK_API, name: row.name };
  const getKorAPI = light ? getAttractionBasicFromAPI : getAttractionFromAPI;

  if (lang === 'ko') {
    if (!row.korContentId) return { apiData: fallback, images: [] };
    try {
      const apiData = await getKorAPI(row.korContentId);
      return { apiData, images: apiData.image ? [toHttps(apiData.image)] : [] };
    } catch (e) {
      console.error(`[TourAPI] ${row.name} (${row.korContentId}) ko:`, e);
      return { apiData: fallback, images: [] };
    }
  }

  // eng_contentId 없으면 kor_contentId로 좌표, 대표이미지 조회
  if (!row.engContentId) {
    if (!row.korContentId) return { apiData: fallback, images: [] };
    try {
      const apiData = await getKorAPI(row.korContentId);
      return { apiData, images: apiData.image ? [toHttps(apiData.image)] : [] };
    } catch (e) {
      console.error(`[TourAPI] ${row.name} (${row.korContentId}) ko-fallback:`, e);
      return { apiData: fallback, images: [] };
    }
  }

  try {
    const engData = await getAttractionFromEngAPI(row.engContentId);
    return { apiData: engData, images: engData.image ? [toHttps(engData.image)] : [] };
  } catch (e) {
    console.error(`[TourAPI] ${row.name} (${row.engContentId}) en:`, e);
    return { apiData: fallback, images: [] };
  }
}

export async function getAreas(): Promise<AreaRow[]> {
  return getAreaRows();
}

// area별로 각 명소의 첫 번째 이미지를 1장씩 모아 반환
// 시트에 명소 추가 → 자동으로 포함됨
export async function getAreaCoverImages(): Promise<Record<string, string[]>> {
  const attractionRows = await getAttractionRows();

  // area별로 그룹핑 (priority 오름차순)
  const grouped = attractionRows.reduce<Record<string, typeof attractionRows>>((acc, row) => {
    if (!acc[row.area]) acc[row.area] = [];
    acc[row.area].push(row);
    return acc;
  }, {});

  const result: Record<string, string[]> = {};

  await Promise.all(
    Object.entries(grouped).map(async ([area, rows]) => {
      const sorted = rows.sort((a, b) => a.priority - b.priority);
      const images = await Promise.all(
        sorted.map(async (row) => {
          if (!row.korContentId) return '';
          try {
            const imgs = await getAttractionImages(row.korContentId);
            return imgs[0] ? toHttps(imgs[0]) : '';
          } catch {
            return '';
          }
        }),
      );
      result[area] = images.filter(Boolean);
    }),
  );

  return result;
}

export async function getAttractionsByArea(area: string, lang: Lang = 'ko'): Promise<Attraction[]> {
  const [attractionRows, pinpoints] = await Promise.all([
    getAttractionRows(),
    getPinpointRows(),
  ]);

  const rows = attractionRows
    .filter((r) => r.area === area)
    .sort((a, b) => a.priority - b.priority);

  return Promise.all(
    rows.map(async (row) => {
      const sheetCenter = row.lat && row.lng ? { lat: row.lat, lng: row.lng } : undefined;
      const { apiData, images } = await fetchAPIData(row, lang, true);
      return buildAttraction(row, pinpoints, apiData, images, sheetCenter);
    }),
  );
}

export async function getAttractionById(id: string, lang: Lang = 'ko'): Promise<Attraction | null> {
  const [attractionRows, pinpoints] = await Promise.all([
    getAttractionRows(),
    getPinpointRows(),
  ]);

  const row = attractionRows.find((r) => r.id === id);
  if (!row) return null;

  const sheetCenter = row.lat && row.lng ? { lat: row.lat, lng: row.lng } : undefined;
  const { apiData, images } = await fetchAPIData(row, lang);
  return buildAttraction(row, pinpoints, apiData, images, sheetCenter);
}
