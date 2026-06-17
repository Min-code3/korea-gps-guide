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
// nation | nation_en | area | dec | area_en | 이동시간 | show_events | event_order
export interface AreaRow {
  nation: string;
  nationEn: string;
  area: string;
  description: string;
  areaEn: string;
  showEvents: boolean;
  eventOrder: number;
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
      showEvents: r[6] === 'TRUE',
      eventOrder: parseInt(r[7]) || 999,
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
// id | area | name | sector | kor_content_id | eng_content_id | lat | lng | admission | defaultZoom | priority | star | tag_csv | hour | Comment | routeOrder | lat2 | lng2
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
  defaultZoom: number;
  priority: number;
  star: string;
  tags: string[];
  sectors: string[];
  sheetHours: string;
  attractionOrder?: number;
  lat2?: number;
  lng2?: number;
}

export async function getAttractionRows(): Promise<AttractionRow[]> {
  const rows = await getRows('attraction');
  return rows
    .filter((r) => r[0] && r[2])
    .map((r) => ({
      id: r[0],
      area: r[1] ?? '',
      name: r[2] ?? '',
      sector: r[3] ?? '',
      korContentId: r[4] ?? '',
      engContentId: r[5] ?? '',
      lat: parseFloat(r[6]) || 0,
      lng: parseFloat(r[7]) || 0,
      admission: r[8] ?? '',
      defaultZoom: parseInt(r[9]) || 16,
      priority: parseInt(r[10]) || 0,
      star: r[11] ?? '',
      tags: r[12] ? r[12].split(',').map((t) => t.trim()).filter(Boolean) : [],
      sectors: r[3] ? r[3].split(',').map((s) => s.trim()).filter(Boolean) : [],
      sheetHours: r[13] ?? '',
      attractionOrder: r[15] ? parseInt(r[15]) || undefined : undefined,
      lat2: r[16] ? parseFloat(r[16]) || undefined : undefined,
      lng2: r[17] ? parseFloat(r[17]) || undefined : undefined,
    }));
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
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      id: r[0],
      area: r[1] ?? '',
      sectorKo: r[2] ?? '',
      priority: parseInt(r[3]) || 0,
      sectorEn: r[4] ?? '',
      addrKeyword: r[5] ?? '',
    }));
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
