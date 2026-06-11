'use client';

import { useState } from 'react';
import type { RestaurantPin } from '@/lib/types';

interface Restaurant {
  contentid: string;
  title: string;
  addr1: string;
  dist: string;
  tel: string;
  firstimage: string;
  mapx: string;
  mapy: string;
}

interface RestaurantDetail {
  firstmenu?: string;
  treatmenu?: string;
  opentimefood?: string;
  restdatefood?: string;
}

interface Props {
  selectedPin: { lat: number; lng: number } | null;
  lang: string;
  onRestaurantsFound: (pins: RestaurantPin[]) => void;
}

const RADII = [
  { label: '500m', value: '500' },
  { label: '1km', value: '1000' },
  { label: '2km', value: '2000' },
  { label: '5km', value: '5000' },
];

function toHttps(url: string) {
  return url.replace(/^http:\/\//i, 'https://');
}

function formatDist(dist: string) {
  const m = parseFloat(dist);
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

export default function NearbyPanel({ selectedPin, lang, onRestaurantsFound }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'current' | 'pin'>('current');
  const [radius, setRadius] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [detailMap, setDetailMap] = useState<Record<string, RestaurantDetail>>({});
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const fetchRestaurants = async () => {
    setLoading(true);
    setError(null);
    setRestaurants([]);
    setDetailMap({});
    setSearched(false);
    onRestaurantsFound([]);

    let lat: number, lng: number;

    if (mode === 'current') {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        setError(lang === 'en' ? 'Location permission denied.' : '위치 권한을 허용해주세요.');
        setLoading(false);
        return;
      }
    } else {
      if (!selectedPin) {
        setError(lang === 'en' ? 'Please select a pin first.' : '핀을 먼저 선택해주세요.');
        setLoading(false);
        return;
      }
      lat = selectedPin.lat;
      lng = selectedPin.lng;
    }

    let list: Restaurant[] = [];
    try {
      const res = await fetch(`/api/nearby?mapX=${lng}&mapY=${lat}&radius=${radius}&contentTypeId=39`);
      const data = await res.json();
      const items = data.response?.body?.items?.item ?? [];
      list = Array.isArray(items) ? items : [items];
      setRestaurants(list);
      onRestaurantsFound(
        list.map((r) => ({
          contentid: r.contentid,
          title: r.title,
          lat: parseFloat(r.mapy),
          lng: parseFloat(r.mapx),
        }))
      );
    } catch {
      setError(lang === 'en' ? 'Failed to load.' : '식당 정보를 불러오지 못했어요.');
      setLoading(false);
      return;
    }

    setLoading(false);
    setSearched(true);

    // 카드에 대표메뉴 표시용 — 백그라운드에서 상세 batch fetch
    if (list.length > 0) {
      setDetailsLoading(true);
      const results = await Promise.all(
        list.map(async (r) => {
          try {
            const res = await fetch(`/api/restaurant-detail?contentId=${r.contentid}`);
            const data = await res.json();
            const info: RestaurantDetail = data.response?.body?.items?.item?.[0] ?? {};
            return [r.contentid, info] as const;
          } catch {
            return [r.contentid, {}] as const;
          }
        })
      );
      setDetailMap(Object.fromEntries(results));
      setDetailsLoading(false);
    }
  };

  const googleMapsUrl = (r: Restaurant) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.title)}&query_ll=${r.mapy},${r.mapx}`;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-white rounded-full px-3 py-1.5 text-xs font-medium text-stone-700 shadow-md border border-stone-200 flex items-center gap-1"
      >
        🍽 {lang === 'en' ? 'Restaurants' : '식당'}
      </button>

      {/* 메인 패널 */}
      {isOpen && !selected && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-end justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
              <p className="font-bold text-stone-800">{lang === 'en' ? 'Nearby Restaurants' : '근처 식당'}</p>
              <button onClick={() => setIsOpen(false)} className="text-stone-400 text-2xl leading-none">×</button>
            </div>

            <div className="px-5 py-3 flex flex-col gap-2.5 shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('current')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${mode === 'current' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-stone-200 text-stone-600'}`}
                >
                  📍 {lang === 'en' ? 'My Location' : '현재위치'}
                </button>
                <button
                  onClick={() => setMode('pin')}
                  disabled={!selectedPin}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${mode === 'pin' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-stone-200 text-stone-600'} disabled:opacity-40`}
                >
                  🗺 {lang === 'en' ? 'Selected Pin' : '선택한 핀'}
                </button>
              </div>

              <div className="flex gap-2">
                {RADII.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRadius(r.value)}
                    className={`flex-1 py-1.5 rounded-full text-xs font-medium border transition-all ${radius === r.value ? 'bg-stone-800 border-stone-800 text-white' : 'bg-white border-stone-200 text-stone-600'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchRestaurants}
                disabled={loading}
                className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm disabled:opacity-50"
              >
                {loading ? (lang === 'en' ? 'Searching...' : '검색 중...') : lang === 'en' ? 'Search' : '검색'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {error && <p className="text-sm text-red-400 text-center py-4">{error}</p>}
              {searched && !loading && restaurants.length === 0 && !error && (
                <p className="text-sm text-stone-400 text-center py-4">
                  {lang === 'en' ? 'No restaurants found.' : '근처에 등록된 식당이 없어요.'}
                </p>
              )}

              <div className="flex flex-col gap-2.5 pt-1">
                {restaurants.map((r) => {
                  const detail = detailMap[r.contentid];
                  return (
                    <button
                      key={r.contentid}
                      className="bg-stone-50 rounded-xl overflow-hidden flex text-left w-full active:bg-stone-100"
                      onClick={() => setSelected(r)}
                    >
                      {/* 사진 */}
                      {r.firstimage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={toHttps(r.firstimage)}
                          alt={r.title}
                          className="w-20 h-20 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-stone-200 shrink-0 flex items-center justify-center text-2xl">🍽</div>
                      )}

                      {/* 텍스트 */}
                      <div className="flex-1 min-w-0 px-3 py-2.5">
                        <p className="font-bold text-stone-800 text-sm truncate">{r.title}</p>
                        {detailsLoading && !detail ? (
                          <p className="text-xs text-stone-300 mt-0.5">로딩 중...</p>
                        ) : detail?.firstmenu ? (
                          <p className="text-xs text-stone-500 mt-0.5 truncate">{detail.firstmenu}</p>
                        ) : null}
                        <p className="text-xs text-amber-600 font-medium mt-1">{formatDist(r.dist)}</p>
                      </div>

                      <span className="text-stone-300 self-center pr-3">›</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 세부 정보 팝업 */}
      {selected && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
              <button onClick={() => setSelected(null)} className="text-stone-500 text-sm">← {lang === 'en' ? 'List' : '목록'}</button>
              <p className="font-bold text-stone-800 text-sm truncate max-w-[60%]">{selected.title}</p>
              <button onClick={() => { setSelected(null); setIsOpen(false); }} className="text-stone-400 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto pb-10">
              {selected.firstimage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toHttps(selected.firstimage)}
                  alt={selected.title}
                  className="w-full h-44 object-cover"
                />
              )}

              <div className="px-5 pt-4 flex flex-col gap-0">
                {(() => {
                  const info = detailMap[selected.contentid] ?? {};
                  const rows: { label: string; value: string }[] = [];
                  if (info.firstmenu) rows.push({ label: lang === 'en' ? 'Signature' : '대표메뉴', value: info.firstmenu });
                  if (info.treatmenu) rows.push({ label: lang === 'en' ? 'Menu' : '메뉴', value: info.treatmenu });
                  if (info.opentimefood) rows.push({ label: lang === 'en' ? 'Hours' : '영업시간', value: info.opentimefood });
                  if (info.restdatefood) rows.push({ label: lang === 'en' ? 'Closed' : '휴무일', value: info.restdatefood });
                  if (selected.addr1) rows.push({ label: lang === 'en' ? 'Address' : '주소', value: selected.addr1 });
                  return rows.map((row) => <DetailRow key={row.label} label={row.label} value={row.value} />);
                })()}
              </div>

              {/* 구글맵 버튼 */}
              <div className="px-5 pt-4">
                <a
                  href={googleMapsUrl(selected)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 text-center text-sm font-medium text-stone-600 border border-stone-200 rounded-xl bg-stone-50 active:bg-stone-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {lang === 'en' ? 'View on Google Maps' : '구글맵에서 보기'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function cleanText(value: string) {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 items-start py-2.5 border-b border-stone-100 last:border-0">
      <p className="text-xs text-stone-400 w-14 shrink-0 pt-0.5">{label}</p>
      <p className="text-sm text-stone-700 flex-1 whitespace-pre-line">{cleanText(value)}</p>
    </div>
  );
}
