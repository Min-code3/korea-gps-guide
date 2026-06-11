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

interface RestaurantDetail {
  firstmenu?: string;
  treatmenu?: string;
  opentimefood?: string;
  restdatefood?: string;
  chkcreditcardfood?: string;
  parkingfood?: string;
  packing?: string;
  infocenterfood?: string;
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
  const [detail, setDetail] = useState<{ restaurant: Restaurant; info: RestaurantDetail } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
      setError(lang === 'en' ? 'Failed to load.' : '식당 정보를 불러오지 못했어요.');
    }

    setLoading(false);
    setSearched(true);
  };

  const openDetail = async (r: Restaurant) => {
    setDetailLoading(true);
    setDetail({ restaurant: r, info: {} });
    try {
      const res = await fetch(`/api/restaurant-detail?contentId=${r.contentid}`);
      const data = await res.json();
      const info: RestaurantDetail = data.response?.body?.items?.item?.[0] ?? {};
      setDetail({ restaurant: r, info });
    } catch {
      // 세부 정보 없어도 기본 정보는 보여줌
    }
    setDetailLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-white rounded-full px-3 py-1.5 text-xs font-medium text-stone-700 shadow-md border border-stone-200 flex items-center gap-1"
      >
        🍽 {lang === 'en' ? 'Restaurants' : '식당'}
      </button>

      {/* 메인 패널 */}
      {isOpen && !detail && (
        <div
          className="fixed inset-0 z-[80] bg-black/40 flex items-end justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '78vh' }}
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
                {loading ? '검색 중...' : lang === 'en' ? 'Search' : '검색'}
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
                {restaurants.map((r) => (
                  <button
                    key={r.contentid}
                    className="bg-stone-50 rounded-xl p-3 flex gap-3 text-left w-full active:bg-stone-100"
                    onClick={() => openDetail(r)}
                  >
                    {r.firstimage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={toHttps(r.firstimage)} alt={r.title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-stone-200 shrink-0 flex items-center justify-center text-2xl">🍽</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-800 text-sm truncate">{r.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5 truncate">{r.addr1}</p>
                      <span className="text-xs text-amber-600 font-medium mt-1 inline-block">{formatDist(r.dist)}</span>
                    </div>
                    <span className="text-stone-300 self-center">›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 세부 정보 팝업 */}
      {detail && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '78vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
              <button onClick={() => setDetail(null)} className="text-stone-400 text-sm">← 목록</button>
              <p className="font-bold text-stone-800 text-sm truncate max-w-[60%]">{detail.restaurant.title}</p>
              <button onClick={() => { setDetail(null); setIsOpen(false); }} className="text-stone-400 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
              {detail.restaurant.firstimage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toHttps(detail.restaurant.firstimage)} alt={detail.restaurant.title}
                  className="w-full h-40 object-cover rounded-xl mb-4" />
              )}

              {detailLoading ? (
                <p className="text-sm text-stone-400 text-center py-4">불러오는 중...</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {detail.info.firstmenu && (
                    <Row icon="🍽" label={lang === 'en' ? 'Signature' : '대표메뉴'} value={detail.info.firstmenu} />
                  )}
                  {detail.info.treatmenu && (
                    <Row icon="📋" label={lang === 'en' ? 'Menu' : '메뉴'} value={detail.info.treatmenu} />
                  )}
                  {detail.info.opentimefood && (
                    <Row icon="⏰" label={lang === 'en' ? 'Hours' : '영업시간'} value={detail.info.opentimefood} />
                  )}
                  {detail.info.restdatefood && (
                    <Row icon="📅" label={lang === 'en' ? 'Closed' : '휴무일'} value={detail.info.restdatefood} />
                  )}
                  {detail.restaurant.tel && (
                    <Row icon="📞" label={lang === 'en' ? 'Tel' : '전화'} value={detail.restaurant.tel} />
                  )}
                  {detail.info.chkcreditcardfood && (
                    <Row icon="💳" label={lang === 'en' ? 'Card' : '카드'} value={detail.info.chkcreditcardfood} />
                  )}
                  {detail.info.parkingfood && (
                    <Row icon="🅿️" label={lang === 'en' ? 'Parking' : '주차'} value={detail.info.parkingfood} />
                  )}
                  {detail.info.packing && (
                    <Row icon="📦" label={lang === 'en' ? 'Takeout' : '포장'} value={detail.info.packing} />
                  )}
                  <div className="mt-1 pt-2 border-t border-stone-100">
                    <p className="text-xs text-stone-400">{detail.restaurant.addr1}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="text-base w-5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-stone-400">{label}</p>
        <p className="text-sm text-stone-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
