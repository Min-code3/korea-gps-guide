import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);

// 실제 TS 모듈을 실행하되 외부 서비스만 메모리 구현으로 바꾼다.
function loadModules(mocks) {
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const loadedModule = { exports: {} };
    modules.set(filename, loadedModule);
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const localRequire = (name) => {
      const resolved = name.startsWith('@/') ? path.join(root, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : name;
      if (mocks.has(resolved)) return mocks.get(resolved);
      if (path.isAbsolute(resolved)) return load(`${resolved}.ts`);
      return require(name);
    };
    const execute = vm.runInThisContext(`(function(require, module, exports) {${outputText}\n})`, { filename });
    execute(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

function fixture(t, count = 8) {
  const state = { active: 0, peak: 0, calls: 0, failure: null };
  const storage = new Map();
  const attractions = Array.from({ length: count }, (_, i) => ({
    id: String(i), area: '부산', name: `명소 ${i}`, korContentId: `ko${i}`, engContentId: `en${i}`,
    lat: 35, lng: 129, priority: i, tags: [], sectors: [], sheetHours: '', hoursUrl: '',
    admission: '', ticketUrl: '', comment: '', star: '',
  }));
  const restaurants = attractions.map((row) => ({ ...row, nameEn: '', addr1: '', firstimage: '',
    tel: '', signature: '', menu: '', hours: '', closed: '' }));
  const sheets = {
    getAttractionRows: async () => attractions, getPinpointRows: async () => [],
    getRestaurantRows: async () => restaurants, getAreaRows: async () => [],
    getTagRows: async () => [], getSectorRows: async () => [],
  };
  const redis = {
    get: async (key) => storage.get(key) ?? null,
    set: async (key, value) => storage.set(key, value),
    scan: async () => [0, [...storage.keys()]],
    del: async (...keys) => keys.forEach((key) => storage.delete(key)),
  };
  const load = loadModules(new Map([
    ['@upstash/redis', { Redis: { fromEnv: () => redis } }],
    [path.join(root, 'lib/sheets'), sheets],
    [path.join(root, 'lib/translate'), { translateBatch: async (texts) => texts }],
  ]));
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    assert.equal(options.cache, 'no-store');
    state.calls++;
    state.active++;
    state.peak = Math.max(state.peak, state.active);
    try {
      await new Promise(setImmediate);
      const url = new URL(input, 'https://tour.test');
      const contentId = url.searchParams.get('contentId');
      const endpoint = url.pathname.split('/').at(-1);
      const failure = state.failure?.({ endpoint, contentId });
      if (failure === 'network') throw new Error('network unavailable');
      if (failure === 'http') return new Response('{}', { status: 429 });
      if (failure === 'xml') return new Response('<error>rate limit</error>');
      if (failure === 'api') return Response.json({ response: { header: { resultCode: '99' } } });
      if (failure === 'malformed') return Response.json({});
      let item;
      if (endpoint === 'detailCommon2') item = { title: `API ${contentId}`, overview: 'Description',
        mapy: '35', mapx: '129', firstimage: `http://images.test/${contentId}.jpg` };
      if (endpoint === 'detailImage2') item = { originimgurl: `http://images.test/${contentId}.jpg` };
      if (endpoint === 'detailIntro2') item = { usetime: '' };
      if (endpoint === 'detailInfo2') item = { infoname: '', infotext: '' };
      return Response.json({ response: { header: { resultCode: '0000' },
        body: { items: { item: failure === 'missing' ? [] : [item] } } } });
    } finally {
      state.active--;
    }
  });
  return { state, storage, attractions, restaurants,
    cache: load(path.join(root, 'lib/cached-data.ts')) };
}

test('cold loads share five HTTP slots, preserve order, and coalesce visitors', async (t) => {
  const { cache, state } = fixture(t, 30);
  const [ko, en, restaurants, covers, ...visitors] = await Promise.all([
    cache.getCachedAttractionsByArea('부산', 'ko'),
    cache.getCachedAttractionsByArea('부산', 'en'),
    cache.getCachedLocalRestaurantsByArea('부산', 'ko'),
    cache.getCachedAreaCoverImages(),
    ...Array.from({ length: 10 }, () => cache.getCachedAttractionsByArea('부산', 'ko')),
  ]);
  assert.equal(state.peak, 5);
  assert.equal(state.active, 0);
  assert.equal(ko.length, 30);
  assert.equal(en[0].name, 'API en0');
  assert.equal(restaurants.length, 30);
  assert.equal(covers['부산'].length, 30);
  assert.deepEqual(ko.map((row) => row.id), Array.from({ length: 30 }, (_, i) => String(i)));
  visitors.forEach((value) => assert.deepEqual(value, ko));
  // KO 90 + EN 90 + EN hours/admission 60 + restaurants 30 + covers 30.
  assert.equal(state.calls, 300);
  await cache.getCachedAreaCoverImages();
  await cache.getCachedAttractionsByArea('부산', 'en');
  assert.equal(state.calls, 300);
});

for (const kind of ['attractions', 'restaurants', 'covers']) {
  test(`${kind}: fallback is served without caching, then recovery is cached`, async (t) => {
    const { cache, state, storage } = fixture(t);
    const endpoint = kind === 'covers' ? 'detailImage2' : 'detailCommon2';
    state.failure = (request) => request.contentId === 'ko0' && request.endpoint === endpoint ? 'api' : null;
    const load = kind === 'attractions' ? () => cache.getCachedAttractionsByArea('부산', 'ko')
      : kind === 'restaurants' ? () => cache.getCachedLocalRestaurantsByArea('부산', 'ko')
        : () => cache.getCachedAreaCoverImages();
    const fallback = await load();
    assert.equal(storage.size, 0);
    if (kind === 'covers') assert.equal(fallback['부산'].length, 7);
    else assert.equal(fallback[0].name, '명소 0');
    state.failure = null;
    const recovered = await load();
    assert.equal(storage.size, 1);
    if (kind === 'covers') assert.equal(recovered['부산'].length, 8);
    else assert.equal(recovered[0].name, 'API ko0');
    const calls = state.calls;
    await load();
    assert.equal(state.calls, calls);
  });
}

for (const failure of ['http', 'xml', 'malformed', 'network', 'missing']) {
  test(`${failure} failures do not poison the cache or leak HTTP slots`, async (t) => {
    const { cache, state, storage } = fixture(t);
    state.failure = () => failure;
    await cache.getCachedAttractionsByArea('부산', 'ko');
    assert.equal(storage.size, 0);
    state.failure = null;
    await cache.getCachedAttractionsByArea('부산', 'ko');
    assert.equal(storage.size, 1);
    assert.ok(state.peak <= 5);
    assert.equal(state.active, 0);
  });
}

test('supplemental EN hours/admission failures also prevent caching', async (t) => {
  const { cache, state, storage } = fixture(t);
  state.failure = ({ contentId, endpoint }) => contentId === 'ko0' &&
    ['detailIntro2', 'detailInfo2'].includes(endpoint) ? 'api' : null;
  await cache.getCachedAttractionsByArea('부산', 'en');
  assert.equal(storage.size, 0);
  state.failure = null;
  await cache.getCachedAttractionsByArea('부산', 'en');
  assert.equal(storage.size, 1);
});

test('failure tracking is isolated between simultaneous cache keys', async (t) => {
  const { cache, state, storage } = fixture(t);
  state.failure = ({ endpoint }) => endpoint === 'detailImage2' ? 'api' : null;
  await Promise.all([cache.getCachedAreaCoverImages(), cache.getCachedLocalRestaurantsByArea('부산', 'ko')]);
  assert.equal(storage.size, 1);
  assert.ok(storage.has('area-content:v2:restaurants:부산:ko'));
});

test('old poisoned caches are bypassed; invalidation includes versioned covers', async (t) => {
  const { cache, storage } = fixture(t);
  storage.set('area-content:attractions:부산:ko', [{ name: '명소 fallback' }]);
  storage.set('area-content:area-cover-images', {});
  assert.equal((await cache.getCachedAttractionsByArea('부산', 'ko'))[0].name, 'API ko0');
  assert.equal((await cache.getCachedAreaCoverImages())['부산'].length, 8);
  assert.equal(await cache.clearAreaContentCache(), 4);
  assert.equal(storage.size, 0);
});
