import { Attraction, LocalRestaurant } from '@/lib/types';
import { getAreaRows, getAttractionRows, getPinpointRows, getRestaurantRows, AreaRow } from '@/lib/sheets';
import { getAttractionBasicFromAPI, getAttractionFromAPI, getAttractionFromEngAPI, getAttractionImages, fetchAdmissionOnly, fetchHoursOnly, getRestaurantBasicFromAPI } from '@/lib/tourapi';
import { translateBatch } from '@/lib/translate';

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
    sectors: row.sectors.length ? row.sectors : undefined,
    attractionOrder: row.attractionOrder,
    // DB 우선 — 직접 관리한 값이 정확도가 높음. 없을 때만 API 사용
    hours: row.sheetHours || apiData.hours,

    description: apiData.description,
    center,
    admission: row.admission || apiData.admission || undefined,
    defaultZoom: 16,
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

export async function getLocalRestaurantsByArea(area: string, lang: Lang = 'ko'): Promise<LocalRestaurant[]> {
  const rows = (await getRestaurantRows()).filter((r) => r.area === area);

  const results = await Promise.all(
    rows.map(async (row): Promise<LocalRestaurant> => {
      // kor_content_id 있으면 API 우선, 없으면 시트 데이터만 사용
      // EN 모드면 name_en 컬럼 우선 사용
      const displayName = (lang === 'en' && row.nameEn) ? row.nameEn : (row.korContentId ? undefined : row.name);

      if (row.korContentId) {
        try {
          const api = await getRestaurantBasicFromAPI(row.korContentId);
          return {
            id: row.id,
            contentid: row.korContentId,
            name: displayName || api.name || row.name,
            addr: row.addr1 || api.addr || undefined,
            center: (row.lat && row.lng)
              ? { lat: row.lat, lng: row.lng }
              : (api.center.lat ? api.center : undefined),
            image: row.firstimage ? toHttps(row.firstimage) : (api.image ? toHttps(api.image) : undefined),
            tel: row.tel || api.tel || undefined,
            signature: row.signature || undefined,
            menu: row.menu || undefined,
            hours: row.hours || undefined,
            closed: row.closed || undefined,
          };
        } catch {
          // API 실패 시 시트 데이터 fallback
        }
      }
      return {
        id: row.id,
        contentid: row.korContentId || undefined,
        name: displayName || row.name,
        addr: row.addr1 || undefined,
        center: (row.lat && row.lng) ? { lat: row.lat, lng: row.lng } : undefined,
        image: row.firstimage ? toHttps(row.firstimage) : undefined,
        tel: row.tel || undefined,
        signature: row.signature || undefined,
        menu: row.menu || undefined,
        hours: row.hours || undefined,
        closed: row.closed || undefined,
      };
    }),
  );

  // EN 모드: 시트에서 온 한국어 텍스트 필드 일괄 번역
  // signature/menu/hours/closed는 시트에서 한국어로 관리됨
  if (lang === 'en') {
    const fields = results.map((r) => [r.signature ?? '', r.menu ?? '', r.hours ?? '', r.closed ?? '', r.addr ?? '']);
    const flat = fields.flat();
    const translated = await translateBatch(flat);
    return results.map((r, i) => ({
      ...r,
      signature: translated[i * 5 + 0] || r.signature,
      menu:      translated[i * 5 + 1] || r.menu,
      hours:     translated[i * 5 + 2] || r.hours,
      closed:    translated[i * 5 + 3] || r.closed,
      addr:      translated[i * 5 + 4] || r.addr,
    }));
  }

  return results;
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

  const allRows = attractionRows
    .filter((r) => r.area === area)
    .sort((a, b) => {
      const starDiff = (b.star ? 1 : 0) - (a.star ? 1 : 0);
      if (starDiff !== 0) return starDiff;
      return a.priority - b.priority;
    });

  // 같은 id 행 그룹핑: 첫 번째 행 = 주 데이터, 나머지 행 = 추가 좌표 핀만 사용
  // 시트에서 하나의 명소에 복수 좌표를 지정할 때 같은 id로 여러 행을 추가
  const idSeen = new Set<string>();
  const rows: typeof allRows = [];
  const extraPinsMap: Record<string, { lat: number; lng: number; order: string }[]> = {};

  for (const row of allRows) {
    if (!idSeen.has(row.id)) {
      idSeen.add(row.id);
      rows.push(row); // 첫 번째 행 = 명소 카드 데이터
      if (row.lat && row.lng && row.attractionOrder) {
        extraPinsMap[row.id] = [{ lat: row.lat, lng: row.lng, order: row.attractionOrder }];
      }
    } else {
      // 추가 행: lat/lng/routeOrder만 수집
      if (row.lat && row.lng && row.attractionOrder) {
        (extraPinsMap[row.id] ??= []).push({ lat: row.lat, lng: row.lng, order: row.attractionOrder });
      }
    }
  }

  // apiData.hours/admission 추적 — EN 모드에서 출처 판별에 사용
  const buildResults = await Promise.all(
    rows.map(async (row) => {
      const sheetCenter = row.lat && row.lng ? { lat: row.lat, lng: row.lng } : undefined;
      const { apiData, images } = await fetchAPIData(row, lang, true);
      const attr = buildAttraction(row, pinpoints, apiData, images, sheetCenter);
      const routePins = extraPinsMap[row.id];
      return {
        attr: routePins && routePins.length > 1 ? { ...attr, routePins } : attr,
        apiHours: apiData.hours,
        apiAdm: apiData.admission,
      };
    }),
  );
  const apiHoursArr = buildResults.map((r) => r.apiHours);
  let result = buildResults.map((r) => r.attr);

  // ── EN 모드 후처리 ───────────────────────────────────────────────
  // 우선순위: DB → API(해당 언어) → API(반대 언어 번역)
  // DB(시트)는 한글로 관리 → EN 모드에서 번역 필요.
  // ENG API 데이터는 이미 영문 → 번역 불필요.
  // KOR API 데이터는 한글 → 번역 필요.
  // KOR API는 '입장료'/'시설이용료', ENG API는 'Admission Fees'/'Facility Utilization Fees' 필드 사용.
  if (lang === 'en') {
    // ── Hours ─────────────────────────────────────────────────────
    // Step 1: engContentId 있는데 DB hours 없고 ENG API도 없으면 → KOR API 시도
    const needsKorHours = rows.map((row, i) =>
      !!(row.engContentId && !row.sheetHours && !apiHoursArr[i] && row.korContentId)
    );
    if (needsKorHours.some(Boolean)) {
      const korFetched = await Promise.all(
        rows.map(async (row, i) => (needsKorHours[i] ? fetchHoursOnly(row.korContentId, 'ko') : ''))
      );
      result = result.map((a, i) =>
        needsKorHours[i] && korFetched[i] ? { ...a, hours: korFetched[i] } : a
      );
    }
    // Step 2: 한글 출처(DB/KOR API) 번역. ENG API 직접 반환값은 번역 제외.
    const needsHoursTranslation = rows.map((row, i) =>
      !!result[i].hours && (!!row.sheetHours || !row.engContentId || !apiHoursArr[i])
    );
    if (needsHoursTranslation.some(Boolean)) {
      const hoursToTranslate = result.map((a, i) => (needsHoursTranslation[i] ? (a.hours ?? '') : ''));
      const translated = await translateBatch(hoursToTranslate);
      result = result.map((a, i) =>
        needsHoursTranslation[i] && translated[i] ? { ...a, hours: translated[i] || a.hours } : a
      );
    }

    // ── Admission ─────────────────────────────────────────────────
    type AdmTask =
      | { type: 'none' }
      | { type: 'translate'; text: string }
      | { type: 'fetch-translate'; contentId: string };

    const admTasks: AdmTask[] = result.map((a, i) => {
      const row = rows[i];
      if (!a.admission) {
        // DB/API 모두 없음 → engContentId 있으면 KOR API 시도
        if (row.engContentId && row.korContentId) return { type: 'fetch-translate', contentId: row.korContentId };
        return { type: 'none' };
      }
      // admission 있음 — 출처가 한글인지 판별
      if (row.admission) return { type: 'translate', text: a.admission }; // DB → 한글
      if (!row.engContentId) return { type: 'translate', text: a.admission }; // KOR API → 한글
      return { type: 'none' }; // ENG API → 이미 영문
    });

    if (admTasks.some((t) => t.type !== 'none')) {
      const fetched = await Promise.all(
        admTasks.map(async (task) => {
          if (task.type === 'fetch-translate') return fetchAdmissionOnly(task.contentId, 'ko');
          if (task.type === 'translate') return task.text;
          return '';
        })
      );
      const toTranslate = fetched.map((adm, i) => (admTasks[i].type !== 'none' ? adm : ''));
      if (toTranslate.some(Boolean)) {
        const translated = await translateBatch(toTranslate);
        result = result.map((a, i) =>
          admTasks[i].type !== 'none' && translated[i] ? { ...a, admission: translated[i] } : a
        );
      }
    }

    // ── Name / Description ────────────────────────────────────────
    // engContentId 없는 명소는 KOR API(한글) name·description 사용 → 번역 필요
    // engContentId 있는 명소는 ENG API에서 이미 영문으로 가져옴 → 번역 불필요
    const needsTextTr = rows.map((row) => !row.engContentId && !!row.korContentId);
    if (needsTextTr.some(Boolean)) {
      const names = result.map((a, i) => (needsTextTr[i] ? (a.name ?? '') : ''));
      const descs = result.map((a, i) => (needsTextTr[i] ? (a.description ?? '') : ''));
      const [trNames, trDescs] = await Promise.all([translateBatch(names), translateBatch(descs)]);
      result = result.map((a, i) =>
        needsTextTr[i]
          ? { ...a, name: trNames[i] || a.name, description: trDescs[i] || a.description }
          : a
      );
    }
  }

  return result;
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
  let attr = buildAttraction(row, pinpoints, apiData, images, sheetCenter);

  // ── 가이드 페이지: getAttractionsByArea와 동일한 우선순위·로직 적용 ─
  // DB 우선 → API(해당 언어) → API(반대 언어 번역)
  if (lang === 'en') {
    // Hours
    if (!attr.hours && row.engContentId && !row.sheetHours && !apiData.hours && row.korContentId) {
      const korH = await fetchHoursOnly(row.korContentId, 'ko');
      if (korH) attr = { ...attr, hours: korH };
    }
    const hoursIsKorean = !!attr.hours && (!!row.sheetHours || !row.engContentId || !apiData.hours);
    if (hoursIsKorean) {
      const [translated] = await translateBatch([attr.hours!]);
      if (translated) attr = { ...attr, hours: translated || attr.hours };
    }

    // Admission
    if (!attr.admission && row.engContentId && row.korContentId) {
      const korAdm = await fetchAdmissionOnly(row.korContentId, 'ko');
      if (korAdm) {
        const [translated] = await translateBatch([korAdm]);
        if (translated) attr = { ...attr, admission: translated };
      }
    } else if (attr.admission && (row.admission || !row.engContentId)) {
      const [translated] = await translateBatch([attr.admission]);
      if (translated) attr = { ...attr, admission: translated };
    }

    // engContentId 없는 명소는 KOR API(한글) name·description → 번역 필요
    if (!row.engContentId && row.korContentId) {
      const [tName, tDesc] = await translateBatch([attr.name ?? '', attr.description ?? '']);
      if (tName) attr = { ...attr, name: tName };
      if (tDesc) attr = { ...attr, description: tDesc };
    }
  }

  return attr;
}
