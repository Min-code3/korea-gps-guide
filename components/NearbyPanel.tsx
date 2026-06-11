'use client';

import { useState } from 'react';

interface Restaurant {
  contentid: string;
  title: string;
  addr1: string;
  dist: string;
  tel: string;
  firstimage: string;
}

interface Props {
  selectedPin: { lat: number; lng: number } | null;
  lang: string;
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

export default function NearbyPanel({ selectedPin, lang }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'current' | 'pin'>('current');
  const [radius, setRadius] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchRestaurants = async () => {
    setLoading(true);
    setError(null);
    setRestaurants([]);
    setSearched(false);

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

    try {
      const res = await fetch(`/api/nearby?mapX=${lng}&mapY=${lat}&radius=${radius}&contentTypeId=39`);
      const data = await res.json();
      const items = data.response?.body?.items?.item ?? [];
      setRestaurants(Array.isArray(items) ? items : [items]);
    } catch {
      setError(lang === 'en' ? 'Failed to load restaurants.' : '식당 정보를 불러오지 못했어요.');
    }

    setLoading(false);
    setSearched(true);
  };

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        onClick={() => setIsOpen(true)}
        className="bg-white rounded-full px-3 py-1.5 text-xs font-medium text-stone-700 shadow-md border border-stone-200 flex items-center gap-1"
      >
        🍽 {lang === 'en' ? 'Restaurants' : '식당'}
      </button>

      {/* 패널 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-end justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '75vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
              <p className="font-bold text-stone-800">{lang === 'en' ? 'Nearby Restaurants' : '근처 식당'}</p>
              <button onClick={() => setIsOpen(false)} className="text-stone-400 text-2xl leading-none">×</button>
            </div>

            {/* 컨트롤 */}
            <div className="px-5 py-3 flex flex-col gap-3 shrink-0">
              {/* 모드 토글 */}
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

              {/* 반경 */}
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

              {/* 검색 버튼 */}
              <button
                onClick={fetchRestaurants}
                disabled={loading}
                className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm disabled:opacity-50"
              >
                {loading ? '검색 중...' : lang === 'en' ? 'Search' : '검색'}
              </button>
            </div>

            {/* 결과 */}
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {error && (
                <p className="text-sm text-red-400 text-center py-4">{error}</p>
              )}
              {searched && !loading && restaurants.length === 0 && !error && (
                <p className="text-sm text-stone-400 text-center py-4">
                  {lang === 'en' ? 'No restaurants found.' : '근처에 등록된 식당이 없어요.'}
                </p>
              )}
              <div className="flex flex-col gap-3 pt-1">
                {restaurants.map((r) => (
                  <div key={r.contentid} className="bg-stone-50 rounded-xl p-3 flex gap-3">
                    {r.firstimage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={toHttps(r.firstimage)}
                        alt={r.title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-stone-200 shrink-0 flex items-center justify-center text-2xl">🍽</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-800 text-sm truncate">{r.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{r.addr1}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-amber-600 font-medium">{formatDist(r.dist)}</span>
                        {r.tel && <span className="text-xs text-stone-400">{r.tel}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
