import { Attraction } from '@/lib/types';
import { getAreaRows, getAttractionRows, getPinpointRows, AreaRow } from '@/lib/sheets';
import { getAttractionFromAPI, getAttractionFromEngAPI, getAttractionImages } from '@/lib/tourapi';

function toHttps(url: string) {
  return url.replace(/^http:\/\//i, 'https://');
}

type Lang = 'ko' | 'en';

function buildAttraction(
  row: Awaited<ReturnType<typeof getAttractionRows>>[number],
  pinpoints: Awaited<ReturnType<typeof getPinpointRows>>,
  apiData: Awaited<ReturnType<typeof getAttractionFromAPI>>,
  images: string[],
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

  return {
    id: row.id,
    name: apiData.name,
    sector: row.sector || undefined,
    description: apiData.description,
    center: apiData.center,
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

async function fetchAPIData(row: { korContentId: string; engContentId: string; name: string }, lang: Lang) {
  const fallback = { ...FALLBACK_API, name: row.name };

  if (lang === 'ko') {
    if (!row.korContentId) return { apiData: fallback, images: [] };
    try {
      const [apiData, images] = await Promise.all([
        getAttractionFromAPI(row.korContentId),
        getAttractionImages(row.korContentId),
      ]);
      return { apiData, images };
    } catch {
      return { apiData: fallback, images: [] };
    }
  }

  const engId = row.engContentId || row.korContentId;
  if (!engId) return { apiData: fallback, images: [] };

  try {
    const [engData, images] = await Promise.all([
      getAttractionFromEngAPI(engId),
      row.korContentId ? getAttractionImages(row.korContentId) : Promise.resolve([]),
    ]);
    return { apiData: engData, images };
  } catch {
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
      const { apiData, images } = await fetchAPIData(row, lang);
      return buildAttraction(row, pinpoints, apiData, images);
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

  const { apiData, images } = await fetchAPIData(row, lang);
  return buildAttraction(row, pinpoints, apiData, images);
}
