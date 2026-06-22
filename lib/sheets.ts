import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

function getPrivateKey() {
  const key = process.env.GOOGLE_PRIVATE_KEY ?? '';
  return key
    .replace(/^["']|["']$/g, '')  // 앞뒤 따옴표 제거
    .replace(/\\n/g, '\n');       // 리터럴 \n → 실제 줄바꿈
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: getPrivateKey(),
    },
    scopes: SCOPES,
  });
}

async function getRows(sheetName: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID!,
    range: `${sheetName}!A2:Z`,
  });
  return (res.data.values as string[][]) ?? [];
}

// ── Sheet: area ─────────────────────────────────────────────────────
// nation | nation_en | area | dec | area_en | event_order | show_events | sector
export interface AreaRow {
  nation: string;
  nationEn: string;
  area: string;
  description: string;
  areaEn: string;
  showEvents: boolean;
  eventOrder: number;
  sectorLabel: string; // e.g. "Sector", "Trip Type"
}

export async function getAreaRows(): Promise<AreaRow[]> {
  const rows = await getRows('area');
  return rows
    .filter((r) => r[2])
    .map((r) => ({
      nation: r[0] ?? '',
      nationEn: r[1] ?? '',
      area: r[2] ?? '',
      description: r[3] ?? '',
      areaEn: r[4] ?? '',
      eventOrder: parseInt(r[5]) || 999,
      showEvents: r[6] === 'TRUE',
      sectorLabel: r[7] ?? '',
    }));
}

// ── Sheet: event_overrides ───────────────────────────────────────────
// id | area | name | contentId | note
export interface EventOverrideRow {
  area: string;
  contentId: string;
  note: string;
}

export async function getEventOverrides(): Promise<EventOverrideRow[]> {
  const rows = await getRows('event_overrides');
  return rows
    .filter((r) => r[3])
    .map((r) => ({
      area: r[1] ?? '',
      contentId: r[3] ?? '',
      note: r[4] ?? '',
    }));
}

// ── Sheet: attraction ───────────────────────────────────────────────
// id | area | name | sector | kor_content_id | eng_content_id | lat | lng | routeOrder | admission | hour | star | priority | tag_csv | Comment
// admission 형식: "텍스트" 또는 "텍스트|https://..." (|로 URL 구분)
export interface AttractionRow {
  id: string;
  area: string;
  name: string;
  sector: string;
  korContentId: string;
  engContentId: string;
  lat: number;
  lng: number;
  admission: string;
  ticketUrl: string;
  priority: number;
  star: string;
  tags: string[];
  sectors: string[];
  sheetHours: string;
  hoursUrl: string;
  attractionOrder?: string;
  comment: string;
}

function parseAdmission(raw: string): { admission: string; ticketUrl: string } {
  const idx = raw.indexOf('|');
  if (idx === -1) return { admission: raw, ticketUrl: '' };
  return { admission: raw.slice(0, idx).trim(), ticketUrl: raw.slice(idx + 1).trim() };
}

export async function getAttractionRows(): Promise<AttractionRow[]> {
  const rows = await getRows('attraction');
  return rows
    .filter((r) => r[0] && r[2])
    .map((r) => {
      const { admission, ticketUrl } = parseAdmission(r[9] ?? '');
      return {
        id: r[0],
        area: r[1] ?? '',
        name: r[2] ?? '',
        sector: r[3] ?? '',
        korContentId: r[4] ?? '',
        engContentId: r[5] ?? '',
        lat: parseFloat(r[6]) || 0,
        lng: parseFloat(r[7]) || 0,
        attractionOrder: r[8]?.trim() || undefined,
        admission,
        ticketUrl,
        ...(() => { const raw = (r[10] ?? '').replace(/\\n/g, '\n'); const idx = raw.indexOf('|'); return idx === -1 ? { sheetHours: raw, hoursUrl: '' } : { sheetHours: raw.slice(0, idx).trim(), hoursUrl: raw.slice(idx + 1).trim() }; })(),
        star: r[11] ?? '',
        priority: parseInt(r[12]) || 0,
        tags: r[13] ? r[13].split(',').map((t) => t.trim()).filter(Boolean) : [],
        sectors: r[3] ? r[3].split(',').map((s) => s.trim()).filter(Boolean) : [],
        comment: (r[14] ?? '').replace(/\\n/g, '\n'),
      };
    });
}

// ── Sheet: sector ────────────────────────────────────────────────────
// id | area | sector | priority | sector_en | addr_keyword
export interface SectorRow {
  id: string;
  area: string;
  sectorKo: string;
  priority: number;
  sectorEn: string;
  addrKeyword: string; // comma-separated, e.g. "해운대,수영구"
}

export async function getSectorRows(): Promise<SectorRow[]> {
  const rows = await getRows('sector');
  const raw = rows
    .filter((r) => r[0])
    .map((r) => ({
      id: r[0],
      area: r[1] ?? '',
      sectorKo: r[2] ?? '',
      priority: parseInt(r[3]) || 0,
      sectorEn: r[4] ?? '',
      addrKeyword: r[5] ?? '',
    }));

  // sectorKo가 "사과, 바나나"처럼 콤마로 묶인 경우 개별 탭으로 분리
  // 의도: 하나의 명소가 여러 섹터에 동시 노출되도록 시트에 입력한 경우
  // dedup 시 sectorEn이 있는 행이 나중에 나와도 반영되도록 Map으로 관리
  const expanded: SectorRow[] = [];
  const seen = new Map<string, number>(); // key -> expanded 배열 인덱스
  for (const row of raw) {
    const koList = row.sectorKo.split(',').map((s) => s.trim()).filter(Boolean);
    const enList = row.sectorEn.split(',').map((s) => s.trim());
    koList.forEach((ko, idx) => {
      const key = `${row.area}:${ko}`;
      const en = enList[idx] ?? '';
      if (seen.has(key)) {
        const existingIdx = seen.get(key)!;
        if (en && !expanded[existingIdx].sectorEn) {
          expanded[existingIdx].sectorEn = en;
        }
        // 기존 priority가 0(미설정)이고 새 행에 명시적 priority가 있으면 업데이트
        if (row.priority > 0 && expanded[existingIdx].priority === 0) {
          expanded[existingIdx].priority = row.priority;
        }
        return;
      }
      seen.set(key, expanded.length);
      expanded.push({ ...row, sectorKo: ko, sectorEn: en });
    });
  }
  return expanded;
}

// ── Sheet: restaurant ───────────────────────────────────────────────
// id | area | name | kor_content_id | addr1 | lat | lng | firstimage | tel | signature | menu | hours | closed
export interface RestaurantRow {
  id: string;
  area: string;
  name: string;
  nameEn: string;
  korContentId: string;
  addr1: string;
  lat: number;
  lng: number;
  firstimage: string;
  tel: string;
  signature: string;
  menu: string;
  hours: string;
  closed: string;
}

export async function getRestaurantRows(): Promise<RestaurantRow[]> {
  const rows = await getRows('restaurant');
  return rows
    .filter((r) => r[0] && r[2])
    .map((r) => ({
      id: r[0],
      area: r[1] ?? '',
      name: r[2] ?? '',
      nameEn: r[3] ?? '',
      korContentId: r[4] ?? '',
      addr1: r[5] ?? '',
      lat: parseFloat(r[6]) || 0,
      lng: parseFloat(r[7]) || 0,
      firstimage: r[8] ?? '',
      tel: r[9] ?? '',
      signature: r[10] ?? '',
      menu: r[11] ?? '',
      hours: r[12] ?? '',
      closed: r[13] ?? '',
    }));
}

// ── Sheet: tag ──────────────────────────────────────────────────────
// id | tag_csv | tag_en
export interface TagRow {
  tag: string;   // emoji key, matches values in attraction tag_csv
  label: string; // display label e.g. "Night View"
}

export async function getTagRows(): Promise<TagRow[]> {
  const rows = await getRows('tag');
  return rows
    .filter((r) => r[1])
    .map((r) => ({
      tag: r[1].trim(),
      label: r[2]?.trim() ?? '',
    }));
}

// ── Sheet: pinpoint ─────────────────────────────────────────────────
// id | area | name | type | autoplay | pin_name | lat | lng | radius | routeOrder | isMainRoute | photo | audio_title | audio
export interface PinpointRow {
  id: string;
  area: string;
  attractionName: string;
  type: 'A' | 'B' | 'C' | 'P';
  autoplay: boolean;
  pinName: string;
  lat: number;
  lng: number;
  radius: number;
  routeOrder?: number;
  isMainRoute?: boolean;
  photo: string;
  audioTitle: string;
  audioSrc: string;
}

export async function getPinpointRows(): Promise<PinpointRow[]> {
  const rows = await getRows('pinpoint');
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      id: r[0],
      area: r[1] ?? '',
      attractionName: r[2] ?? '',
      type: (r[3] as 'A' | 'B' | 'C' | 'P') || 'B',
      autoplay: r[4] !== 'FALSE',
      pinName: r[5] ?? '',
      lat: parseFloat(r[6]) || 0,
      lng: parseFloat(r[7]) || 0,
      radius: parseFloat(r[8]) || 0,
      routeOrder: r[9] ? parseInt(r[9]) : undefined,
      isMainRoute: r[10] === 'TRUE' ? true : r[10] === 'FALSE' ? false : undefined,
      photo: r[11] ?? '',
      audioTitle: r[12] ?? '',
      audioSrc: r[13] ?? '',
    }));
}
