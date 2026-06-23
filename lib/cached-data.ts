import { unstable_cache } from 'next/cache';
import { getAttractionsByArea, getLocalRestaurantsByArea } from './data';
import { getTagRows, getSectorRows, getAreaRows } from './sheets';

export const CACHE_TAG = 'area-content';

export const getCachedAttractionsByArea = unstable_cache(
  (area: string, lang: 'ko' | 'en') => getAttractionsByArea(area, lang),
  ['attractions-by-area'],
  { tags: [CACHE_TAG], revalidate: false }
);

export const getCachedLocalRestaurantsByArea = unstable_cache(
  (area: string, lang: 'ko' | 'en') => getLocalRestaurantsByArea(area, lang),
  ['restaurants-by-area'],
  { tags: [CACHE_TAG], revalidate: false }
);

export const getCachedTagRows = unstable_cache(
  () => getTagRows(),
  ['tag-rows'],
  { tags: [CACHE_TAG], revalidate: false }
);

export const getCachedSectorRows = unstable_cache(
  () => getSectorRows(),
  ['sector-rows'],
  { tags: [CACHE_TAG], revalidate: false }
);

export const getCachedAreaRows = unstable_cache(
  () => getAreaRows(),
  ['area-rows'],
  { tags: [CACHE_TAG], revalidate: false }
);
