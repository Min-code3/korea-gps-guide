import { Redis } from '@upstash/redis';
import { getAttractionsByArea, getLocalRestaurantsByArea } from './data';
import { getTagRows, getSectorRows, getAreaRows } from './sheets';

const redis = Redis.fromEnv();

const KEY_PREFIX = 'area-content:';

// Vercel 서버리스 인스턴스가 재활용되면 unstable_cache(파일시스템 기반)는 휘발된다.
// Upstash Redis는 인스턴스 밖에 있어 인스턴스가 몇 번 바뀌어도 캐시가 유지된다.
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = await redis.get<T>(KEY_PREFIX + key);
  if (hit !== null && hit !== undefined) return hit;
  const fresh = await fn();
  await redis.set(KEY_PREFIX + key, fresh);
  return fresh;
}

export async function getCachedAttractionsByArea(area: string, lang: 'ko' | 'en') {
  return cached(`attractions:${area}:${lang}`, () => getAttractionsByArea(area, lang));
}

export async function getCachedLocalRestaurantsByArea(area: string, lang: 'ko' | 'en') {
  return cached(`restaurants:${area}:${lang}`, () => getLocalRestaurantsByArea(area, lang));
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
