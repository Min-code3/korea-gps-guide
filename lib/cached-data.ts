import { Redis } from '@upstash/redis';
import { getAttractionsByArea, getLocalRestaurantsByArea, getAreaCoverImages } from './data';
import { getTagRows, getSectorRows, getAreaRows } from './sheets';
import { withTourAPIStatus } from './tourapi-requests';

const redis = Redis.fromEnv();

const KEY_PREFIX = 'area-content:';
// 실패한 fallback이 영구 저장된 기존 TourAPI 캐시는 다시 사용하지 않는다.
const TOUR_CACHE_VERSION = 'v2:';
const pending = new Map<string, Promise<unknown>>();

// 인스턴스 밖의 Redis에 저장해 서버리스 인스턴스 간에도 캐시를 공유한다.
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const load = async () => {
    const hit = await redis.get<T>(KEY_PREFIX + key);
    if (hit !== null && hit !== undefined) return hit;
    const { value, failed } = await withTourAPIStatus(fn);
    // 화면에는 fallback을 제공하되 다음 방문에서 API를 다시 시도한다.
    if (!failed) await redis.set(KEY_PREFIX + key, value);
    return value;
  };

  const promise = load();
  pending.set(key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
}

export async function getCachedAttractionsByArea(area: string, lang: 'ko' | 'en') {
  return cached(`${TOUR_CACHE_VERSION}attractions:${area}:${lang}`, () => getAttractionsByArea(area, lang));
}

export async function getCachedLocalRestaurantsByArea(area: string, lang: 'ko' | 'en') {
  return cached(`${TOUR_CACHE_VERSION}restaurants:${area}:${lang}`, () => getLocalRestaurantsByArea(area, lang));
}

export async function getCachedTagRows() {
  return cached('tag-rows', () => getTagRows());
}

export async function getCachedSectorRows() {
  return cached('sector-rows', () => getSectorRows());
}

export async function getCachedAreaRows() {
  return cached('area-rows', () => getAreaRows());
}

export async function getCachedAreaCoverImages() {
  return cached(`${TOUR_CACHE_VERSION}area-cover-images`, () => getAreaCoverImages());
}

/** 시트 수정 후 캐시 전체 삭제 (다음 호출 시 새로 채워짐) */
export async function clearAreaContentCache() {
  let cursor = 0;
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: `${KEY_PREFIX}*`, count: 100 });
    cursor = Number(next);
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== 0);
  return deleted;
}
