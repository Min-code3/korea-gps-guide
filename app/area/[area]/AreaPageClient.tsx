'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Attraction, RestaurantPin, LocalRestaurant } from '@/lib/types';
import type { SectorRow } from '@/lib/sheets';
import { t, type Lang, type MessageKey } from '@/lib/i18n';
import ImageLightbox from '@/components/ImageLightbox';
import NearbyPanel from '@/components/NearbyPanel';
import EventList from '@/components/EventList';

const TourMap = dynamic(() => import('@/components/TourMap'), { ssr: false });

interface Props {
  area: string;
  lang: string;
  attractions: Attraction[];
  sectors: SectorRow[];
  tagMap: Record<string, string>;
  center: { lat: number; lng: number };
  localRestaurants: LocalRestaurant[];
}

interface LightboxState {
  images: string[];
  index: number;
}

function toHttps(url: string) {
  return url.replace(/^http:\/\//i, 'https://');
}

const DESC_LIMIT = 55;

interface SectorEventItem {
  contentid: string;
  title: string;
  addr1: string;
  eventstartdate: string;
  eventenddate: string;
  firstimage: string;
  tel: string;
  detail?: {
    overview?: string | null;
    homepage?: string | null;
    tel?: string | null;
    playtime?: string | null;
    eventplace?: string | null;
    usetimefestival?: string | null;
  };
}

function formatEventDate(yyyymmdd: string): string {
  return `${parseInt(yyyymmdd.slice(4, 6))}.${parseInt(yyyymmdd.slice(6, 8))}`;
}

function stripEventHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function getEventStatus(start: string, end: string, todayYMD: string) {
  if (end < todayYMD) return 'ended';
  const msDay = 86400000;
  const todayMs = new Date(`${todayYMD.slice(0,4)}-${todayYMD.slice(4,6)}-${todayYMD.slice(6,8)}`).getTime();
  const endMs = new Date(`${end.slice(0,4)}-${end.slice(4,6)}-${end.slice(6,8)}`).getTime();
  if (start > todayYMD) {
    const startMs = new Date(`${start.slice(0,4)}-${start.slice(4,6)}-${start.slice(6,8)}`).getTime();
    return Math.ceil((startMs - todayMs) / msDay) <= 7 ? 'soon' : 'upcoming';
  }
  return Math.ceil((endMs - todayMs) / msDay) <= 3 ? 'ending' : 'active';
}

const EVENT_STATUS_BADGE: Record<string, { labelKey: MessageKey; cls: string }> = {
  active:   { labelKey: 'event.badge.active',   cls: 'bg-green-100 text-green-700' },
  soon:     { labelKey: 'event.badge.soon',      cls: 'bg-amber-100 text-amber-700' },
  ending:   { labelKey: 'event.badge.ending',    cls: 'bg-red-100 text-red-600' },
  upcoming: { labelKey: 'event.badge.upcoming',  cls: 'bg-stone-100 text-stone-500' },
};

export default function AreaPageClient({ area, lang, attractions, sectors, tagMap, center, localRestaurants }: Props) {
  const l = lang as Lang;
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null; // 하위 호환 — 단일 선택 맥락에서 사용
  const [isSectorMode, setIsSectorMode] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [galleryCache, setGalleryCache] = useState<Record<string, string[]>>({});
  const [detailAttr, setDetailAttr] = useState<Attraction | null>(null);
  const [restaurantPins, setRestaurantPins] = useState<RestaurantPin[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [restaurantSubTab, setRestaurantSubTab] = useState<'nearby' | 'local'>('nearby');
  const [selectedLocalRestaurant, setSelectedLocalRestaurant] = useState<LocalRestaurant | null>(null);
  const [localDetailMap, setLocalDetailMap] = useState<Record<string, { firstmenu?: string; treatmenu?: string; opentimefood?: string; restdatefood?: string }>>({});
  const localRestaurantPins: RestaurantPin[] = useMemo(
    () => localRestaurants.filter((r) => r.center).map((r) => ({
      contentid: r.contentid || r.id,
      title: r.name,
      lat: r.center!.lat,
      lng: r.center!.lng,
    })),
    [localRestaurants],
  );
  const [mode, setMode] = useState<'highlights' | 'attractions' | 'restaurants' | 'events'>('highlights');
  const [areaEvents, setAreaEvents] = useState<SectorEventItem[]>([]);
  const [selectedSectorEvent, setSelectedSectorEvent] = useState<SectorEventItem | null>(null);
  const todayYMD = useMemo(() => toYMD(new Date()), []);

  // 카드 스크롤용 refs
  const attractionCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const localRestaurantCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 명소 핀 클릭 → 해당 카드로 스크롤
  useEffect(() => {
    if (!selectedId || isSectorMode) return;
    attractionCardRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId, isSectorMode]);

  // 식당 핀 클릭 → 로컬 식당 카드로 스크롤 (NearbyPanel은 내부에서 자체 처리)
  useEffect(() => {
    if (!selectedRestaurantId || restaurantSubTab !== 'local') return;
    localRestaurantCardRefs.current[selectedRestaurantId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedRestaurantId, restaurantSubTab]);

  useEffect(() => {
    fetch(`/api/events?area=${encodeURIComponent(area)}&lang=${lang}`)
      .then(r => r.json())
      .then(data => setAreaEvents(data.events ?? []))
      .catch(() => {});
  }, [area, lang]);

  // 로컬 탭 진입 시 contentid 있는 식당의 메뉴/영업시간 등 detail 정보 pre-fetch
  // NearbyPanel과 동일한 /api/restaurant-detail 사용 (시트 데이터 없을 때 API로 보완)
  useEffect(() => {
    if (restaurantSubTab !== 'local') return;
    const toFetch = localRestaurants.filter((r) => r.contentid && !localDetailMap[r.contentid]);
    if (toFetch.length === 0) return;
    Promise.all(
      toFetch.map(async (r) => {
        try {
          const res = await fetch(`/api/restaurant-detail?contentId=${r.contentid}&lang=${lang}`);
          const data = await res.json();
          return [r.contentid!, data.response?.body?.items?.item?.[0] ?? {}] as const;
        } catch { return [r.contentid!, {}] as const; }
      })
    ).then((results) => {
      setLocalDetailMap((prev) => ({ ...prev, ...Object.fromEntries(results) }));
    });
  }, [restaurantSubTab, localRestaurants, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // firstimage 없는 명소 썸네일을 배경에서 순차적으로 프리로드
  useEffect(() => {
    const missing = attractions.filter(
      a => a.contentId && (!a.images || a.images.length === 0)
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const a of missing) {
        if (cancelled || !a.contentId) break;
        try {
          const res = await fetch(`/api/attraction-images?contentId=${a.contentId}`);
          const data = await res.json();
          const imgs: string[] = data.images ?? [];
          if (imgs.length > 0 && !cancelled) {
            setGalleryCache(prev => ({ ...prev, [a.contentId!]: imgs }));
          }
        } catch {}
        // 연속 호출 rate limit 방지
        await new Promise(r => setTimeout(r, 1200));
      }
    })();

    return () => { cancelled = true; };
  }, [attractions]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedSectors = useMemo(
    () => [...sectors].sort((a, b) => a.priority - b.priority),
    [sectors]
  );

  const [activeSector, setActiveSector] = useState<string>(
    sortedSectors[0]?.sectorKo ?? ''
  );

  const highlightAttractions = useMemo(
    () => attractions.filter((a) => !!a.star),
    [attractions]
  );

  const [highlightSubTab, setHighlightSubTab] = useState<'top' | 'all'>('top');

  const sectorAttractions = useMemo(() => {
    if (mode === 'highlights') return highlightSubTab === 'top' ? highlightAttractions : attractions;
    return activeSector ? attractions.filter((a) => a.sectors?.includes(activeSector)) : attractions;
  }, [attractions, highlightAttractions, activeSector, mode, highlightSubTab]);

  const sectorIds = useMemo(
    () => sectorAttractions.map((a) => a.id),
    [sectorAttractions]
  );

  // 좌표 공유 lookup: "lat,lng" → 해당 좌표를 가진 attraction ID 목록
  // center, center2, routePins 모두 포함 — 같은 좌표 핀 클릭 시 여러 명소 동시 하이라이트
  const coordToIds = useMemo(() => {
    const map: Record<string, string[]> = {};
    const add = (lat: number, lng: number, id: string) => {
      const key = `${lat},${lng}`;
      if (!(map[key] ??= []).includes(id)) map[key].push(id);
    };
    for (const a of attractions) {
      add(a.center.lat, a.center.lng, a.id);
      if (a.center2) add(a.center2.lat, a.center2.lng, a.id);
      for (const p of a.routePins ?? []) add(p.lat, p.lng, a.id);
    }
    return map;
  }, [attractions]);

  const handleCardTap = (attractionId: string) => {
    const attr = attractions.find((a) => a.id === attractionId);
    const hasGuide = (attr?.aBlocks?.length ?? 0) > 0 || (attr?.pins?.length ?? 0) > 0;
    if (hasGuide && !isSectorMode && selectedIds.includes(attractionId)) {
      router.push(`/guide/${attractionId}?lang=${lang}`);
    } else {
      setIsSectorMode(false);
      setSelectedIds([attractionId]);
    }
  };

  const handlePinClick = (attractionId: string, pinLat?: number, pinLng?: number) => {
    const attr = attractions.find((a) => a.id === attractionId);
    if (attr?.sectors?.length) setActiveSector(attr.sectors[0]);
    setIsSectorMode(false);
    // 클릭한 핀의 실제 좌표로 공유 명소 조회 (routePins 포함)
    const lat = pinLat ?? attr?.center.lat;
    const lng = pinLng ?? attr?.center.lng;
    const shared = (lat != null && lng != null) ? (coordToIds[`${lat},${lng}`] ?? [attractionId]) : [attractionId];
    setSelectedIds(shared.length > 1 ? shared : [attractionId]);
  };

  // 현재 sector의 addr_keyword와 일치하는 행사
  const sectorEvents = useMemo(() => {
    const keywords = (sortedSectors.find(s => s.sectorKo === activeSector)?.addrKeyword ?? '')
      .split(',').map(k => k.trim()).filter(Boolean);
    if (!keywords.length) return [];
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return areaEvents.filter(e =>
      e.eventenddate >= today &&
      keywords.some(kw => (e.addr1 ?? '').includes(kw))
    );
  }, [areaEvents, activeSector, sortedSectors]);

  const openLightbox = async (attraction: Attraction, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const initial = (attraction.images ?? []).map(toHttps);

    // 이미 캐시된 갤러리가 있으면 바로 열기
    if (attraction.contentId && galleryCache[attraction.contentId]) {
      setLightbox({ images: galleryCache[attraction.contentId], index });
      return;
    }

    // initial 이미지로 먼저 열고, contentId 있으면 전체 갤러리 lazy load
    setLightbox({ images: initial, index });

    if (!attraction.contentId) return;

    setLightboxLoading(true);
    try {
      const res = await fetch(`/api/attraction-images?contentId=${attraction.contentId}`);
      const data = await res.json();
      const full: string[] = data.images ?? [];
      if (full.length > 0) {
        setGalleryCache(prev => ({ ...prev, [attraction.contentId!]: full }));
        setLightbox(prev => prev ? { ...prev, images: full } : null);
      }
    } catch { /* 실패해도 initial 이미지로 유지 */ }
    finally { setLightboxLoading(false); }
  };

  return (
    <>
      <main className="relative flex flex-col h-dvh overflow-hidden bg-stone-50">
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-50 bg-white rounded-full px-3 py-1.5 text-xs text-stone-600 shadow-md"
        >
          {t(lang as 'ko' | 'en', 'back')}
        </button>

        <div className="h-[45vh] shrink-0">
          <TourMap
            attractions={mode === 'highlights' ? (highlightSubTab === 'top' ? highlightAttractions : attractions) : attractions}
            center={center}
            defaultZoom={13}
            selectedId={selectedId}
            selectedIds={selectedIds}
            sectorIds={sectorIds}
            isSectorMode={isSectorMode}
            onPinClick={handlePinClick}
            restaurantPins={mode === 'restaurants' && restaurantSubTab === 'local' ? localRestaurantPins : (mode === 'restaurants' ? restaurantPins : [])}
            selectedRestaurantId={selectedRestaurantId}
            onRestaurantPinClick={setSelectedRestaurantId}
            lang={lang}
            showOrder={mode === 'attractions' || mode === 'highlights'}
          />
        </div>

        {/* 하이라이트 / 섹터 / 식당 / 행사 모드 탭 */}
        <div className="px-5 pt-3 pb-1 shrink-0 flex gap-2 overflow-x-auto no-scrollbar">
          {(['highlights', 'attractions', 'restaurants', 'events'] as const).map((m) => {
            const labelKey: MessageKey = m === 'highlights' ? 'tab.highlights' : m === 'attractions' ? 'tab.sector' : m === 'restaurants' ? 'tab.restaurants' : 'tab.events';
            const label = t(l, labelKey);
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${mode === m ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* highlights 서브탭: Top | All */}
        {mode === 'highlights' && highlightAttractions.length > 0 && (
          <div className="px-5 pt-2 pb-1 shrink-0 flex gap-2">
            {(['top', 'all'] as const).map((tab) => {
              const label = tab === 'top'
                ? (lang === 'en' ? 'Top Picks' : '추천')
                : (lang === 'en' ? 'All' : '전체');
              return (
                <button
                  key={tab}
                  onClick={() => setHighlightSubTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    highlightSubTab === tab
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-stone-200 text-stone-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* sector tabs */}
        {mode === 'attractions' && sortedSectors.length > 0 && (
          <div className="px-5 pt-2 pb-2 bg-stone-50 shrink-0">
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {sortedSectors.map((s) => {
                const label = lang === 'en' ? (s.sectorEn || s.sectorKo) : s.sectorKo;
                const active = activeSector === s.sectorKo;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                    setActiveSector(s.sectorKo);
                    setIsSectorMode(true);
                    const first = attractions.find((a) => a.sectors?.includes(s.sectorKo));
                    setSelectedIds(first ? [first.id] : []);
                  }}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      active
                        ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                        : 'bg-white border-stone-200 text-stone-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}


        {/* 행사 리스트 */}
        {mode === 'events' && (
          <EventList area={area} lang={lang} />
        )}

        {/* 식당 */}
        {mode === 'restaurants' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* 근처 식당 / 핀 / 로컬 인기 서브탭 */}
            <div className="flex gap-2 px-5 pt-3 pb-1 shrink-0">
              {([
                { key: 'nearby', label: 'restaurant.nearby' },
                { key: 'local',  label: 'restaurant.local' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRestaurantSubTab(key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    restaurantSubTab === key
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-stone-500 border border-stone-200'
                  }`}
                >
                  {t(l, label)}
                </button>
              ))}
            </div>

            {restaurantSubTab === 'nearby' && (
              <NearbyPanel
                inline
                selectedPin={attractions.find((a) => a.id === selectedId)?.center ?? null}
                lang={lang}
                onRestaurantsFound={setRestaurantPins}
                highlightedId={selectedRestaurantId}
                onRestaurantHighlight={setSelectedRestaurantId}
              />
            )}

            {restaurantSubTab === 'local' && (
              <div className="flex-1 overflow-y-auto px-5 pb-10">
                <div className="flex flex-col gap-2.5 pt-1">
                  {localRestaurants.length === 0 && (
                    <p className="text-sm text-stone-400 text-center mt-10">{t(l, 'restaurant.empty')}</p>
                  )}
                  {localRestaurants.map((r) => {
                    const rid = r.contentid || r.id;
                    const isHighlighted = selectedRestaurantId === rid;
                    const detail = r.contentid ? localDetailMap[r.contentid] : undefined;
                    const displayMenu = r.signature || detail?.firstmenu;
                    return (
                      <button
                        key={r.id}
                        ref={(el) => { localRestaurantCardRefs.current[rid] = el; }}
                        className={`rounded-xl overflow-hidden flex text-left w-full active:bg-stone-100 transition-all ${isHighlighted ? 'bg-amber-50 ring-2 ring-amber-400' : 'bg-stone-50'}`}
                        onClick={() => {
                          if (isHighlighted) {
                            setSelectedLocalRestaurant(r);
                          } else {
                            setSelectedRestaurantId(rid);
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0 px-3 py-2.5">
                          <p className="font-bold text-stone-800 text-sm truncate">{r.name}</p>
                          {displayMenu && (
                            <p className="text-xs text-stone-500 mt-0.5 truncate">{displayMenu}</p>
                          )}
                          {r.addr && (
                            <p className="text-xs text-amber-600 font-medium mt-1 truncate">{r.addr}</p>
                          )}
                        </div>
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt={r.name} className="w-20 h-20 object-cover shrink-0" />
                        ) : (
                          <div className="w-20 h-20 shrink-0 bg-stone-50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* attraction list */}
        {(mode === 'highlights' || mode === 'attractions') && <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-3 pt-1">
          {sectorAttractions.map((attraction) => {
            const isSelected = !isSectorMode && selectedIds.includes(attraction.id);
            const images = (attraction.images ?? []).map(toHttps);
            const cached = attraction.contentId ? (galleryCache[attraction.contentId] ?? []) : [];
            const thumb = images[0] || cached[0];
            const tagBadges = Object.keys(tagMap).filter((tag) => attraction.tags?.includes(tag));
            const desc = attraction.description ?? '';
            const shortDesc = desc.length > DESC_LIMIT ? desc.slice(0, DESC_LIMIT) : desc;
            const hasMore = desc.length > DESC_LIMIT;

            return (
              <button
                key={attraction.id}
                ref={(el) => { attractionCardRefs.current[attraction.id] = el; }}
                className={`w-full text-left bg-white rounded-2xl shadow-sm px-5 py-4 transition-all active:bg-stone-50 ${isSelected ? 'ring-2 ring-amber-500' : ''}`}
                onClick={() => handleCardTap(attraction.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* name + star + tag badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-base font-bold text-stone-800">{attraction.name}</p>
                      {attraction.star && <span className="text-sm">{attraction.star}</span>}
                      {tagBadges.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50">
                          {tagMap[tag]}
                        </span>
                      ))}
                    </div>

                    {/* description */}
                    {shortDesc && (
                      <p className="text-sm text-stone-400 mt-0.5">
                        {shortDesc}
                        {hasMore && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="text-amber-500 font-medium ml-0.5"
                            onClick={(e) => { e.stopPropagation(); setDetailAttr(attraction); }}
                            onKeyDown={(e) => e.key === 'Enter' && setDetailAttr(attraction)}
                          >
                            ...{t(l, 'gallery.more')}
                          </span>
                        )}
                      </p>
                    )}

                    {/* admission */}
                    {attraction.admission && (
                      <p className="text-xs text-stone-400 mt-1 whitespace-pre-line">🎫 {attraction.admission}</p>
                    )}

                    {/* hours */}
                    {attraction.hours && (
                      <p className="text-xs text-stone-400 mt-0.5 whitespace-pre-line">⏰ {attraction.hours}</p>
                    )}

                  </div>

                  {/* thumbnail */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => openLightbox(attraction, 0, e)}
                    onKeyDown={(e) => e.key === 'Enter' && openLightbox(attraction, 0, e as never)}
                    className={`shrink-0 rounded-xl overflow-hidden cursor-pointer ${thumb ? '' : 'bg-white'}`}
                    style={{ width: 80, height: 80, minWidth: 80, maxWidth: 80, minHeight: 80, maxHeight: 80 }}
                  >
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={attraction.name}
                        style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }}
                      />
                    )}
                  </div>

                  <span className="text-amber-500 text-lg shrink-0 self-center">
                    {isSelected ? '→' : '›'}
                  </span>
                </div>
              </button>
            );
          })}

          {/* sector 매칭 행사 */}
          {sectorEvents.length > 0 && (
            <>
              <p className="text-xs text-stone-400 font-medium pt-2 pb-1">{t(l, 'event.sectionTitle')}</p>
              {sectorEvents.map(event => {
                const status = getEventStatus(event.eventstartdate, event.eventenddate, todayYMD);
                const badge = EVENT_STATUS_BADGE[status];
                return (
                  <button
                    key={event.contentid}
                    className="w-full text-left bg-white rounded-2xl shadow-sm px-4 py-3 flex items-start gap-3 active:bg-stone-50"
                    onClick={() => setSelectedSectorEvent(event)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {badge && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                            {t(l, badge.labelKey)}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">
                          {formatEventDate(event.eventstartdate)} ~ {formatEventDate(event.eventenddate)}
                        </span>
                      </div>
                      <p className="font-bold text-stone-800 text-sm">{event.title}</p>
                      {event.detail?.playtime && (
                        <p className="text-xs text-stone-500 mt-0.5 truncate">{stripEventHtml(event.detail.playtime)}</p>
                      )}
                    </div>
                    <div
                      className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-stone-100 flex items-center justify-center text-stone-300 text-2xl"
                      style={{ minWidth: 80 }}
                    >
                      {event.firstimage
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={toHttps(event.firstimage)} alt={event.title} style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }} />
                        : '🎪'}
                    </div>
                    <span className="text-amber-500 text-lg shrink-0 self-center">›</span>
                  </button>
                );
              })}
            </>
          )}
        </div>}
      </main>

      {/* description detail popup */}
      {detailAttr && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 flex items-end justify-center"
          onClick={() => setDetailAttr(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg px-6 pt-5 pb-10 max-h-[60vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-stone-800 text-base">{detailAttr.name}</p>
              <button
                onClick={() => setDetailAttr(null)}
                className="text-stone-400 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">{detailAttr.description}</p>
          </div>
        </div>
      )}

      {/* sector 행사 세부 팝업 */}
      {selectedSectorEvent && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
          onClick={() => setSelectedSectorEvent(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
              <p className="font-bold text-stone-800 text-sm truncate max-w-[80%]">{selectedSectorEvent.title}</p>
              <button onClick={() => setSelectedSectorEvent(null)} className="text-stone-400 text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto pb-10">
              {selectedSectorEvent.firstimage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toHttps(selectedSectorEvent.firstimage)} alt={selectedSectorEvent.title}
                  className="w-full object-contain bg-stone-100" style={{ maxHeight: 240 }} />
              )}
              <div className="px-5 pt-4 flex flex-col gap-0">
                {(() => {
                  const d = selectedSectorEvent.detail ?? {};
                  const rows = [
                    { label: t(l, 'event.field.period'),  value: `${formatEventDate(selectedSectorEvent.eventstartdate)} ~ ${formatEventDate(selectedSectorEvent.eventenddate)}` },
                    d.eventplace      && { label: t(l, 'event.field.venue'),   value: d.eventplace },
                    { label: t(l, 'event.field.address'), value: selectedSectorEvent.addr1 },
                    d.playtime        && { label: t(l, 'event.field.hours'),   value: stripEventHtml(d.playtime) },
                    d.usetimefestival && { label: t(l, 'event.field.fee'),     value: d.usetimefestival },
                    d.tel             && { label: t(l, 'event.field.tel'),     value: d.tel },
                    d.homepage        && { label: t(l, 'event.field.website'), value: d.homepage.replace(/<[^>]+>/g, '').trim() },
                  ].filter(Boolean) as { label: string; value: string }[];
                  return rows.map(row => (
                    <div key={row.label} className="flex gap-3 items-start py-2.5 border-b border-stone-100 last:border-0">
                      <p className="text-xs text-stone-400 w-16 shrink-0 pt-0.5">{row.label}</p>
                      <p className="text-sm text-stone-700 flex-1 whitespace-pre-line">{row.value}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 로컬 식당 세부정보 팝업 */}
      {selectedLocalRestaurant && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
          onClick={() => setSelectedLocalRestaurant(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
              <button onClick={() => setSelectedLocalRestaurant(null)} className="text-stone-500 text-sm">
                ← {t(l, 'restaurant.back')}
              </button>
              <p className="font-bold text-stone-800 text-sm truncate max-w-[60%]">{selectedLocalRestaurant.name}</p>
              <button onClick={() => setSelectedLocalRestaurant(null)} className="text-stone-400 text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto pb-10">
              {selectedLocalRestaurant.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedLocalRestaurant.image} alt={selectedLocalRestaurant.name} className="w-full h-44 object-cover" />
              )}
              <div className="px-5 pt-4 flex flex-col gap-0">
                {(() => {
                  const d = selectedLocalRestaurant.contentid ? (localDetailMap[selectedLocalRestaurant.contentid] ?? {}) : {};
                  const rows: { label: string; value: string }[] = [];
                  const sig = selectedLocalRestaurant.signature || d.firstmenu;
                  const menu = selectedLocalRestaurant.menu || d.treatmenu;
                  const hours = selectedLocalRestaurant.hours || d.opentimefood;
                  const closed = selectedLocalRestaurant.closed || d.restdatefood;
                  if (sig)    rows.push({ label: t(l, 'restaurant.field.signature'), value: sig });
                  if (menu)   rows.push({ label: t(l, 'restaurant.field.menu'),      value: menu });
                  if (hours)  rows.push({ label: t(l, 'restaurant.field.hours'),     value: hours });
                  if (closed) rows.push({ label: t(l, 'restaurant.field.closed'),    value: closed });
                  if (selectedLocalRestaurant.addr) rows.push({ label: t(l, 'restaurant.field.address'), value: selectedLocalRestaurant.addr });
                  if (selectedLocalRestaurant.tel)  rows.push({ label: t(l, 'restaurant.field.tel'),     value: selectedLocalRestaurant.tel });
                  return rows.map((row) => (
                    <div key={row.label} className="flex gap-3 items-start py-2.5 border-b border-stone-100 last:border-0">
                      <p className="text-xs text-stone-400 w-16 shrink-0 pt-0.5">{row.label}</p>
                      <p className="text-sm text-stone-700 flex-1 whitespace-pre-line">{row.value}</p>
                    </div>
                  ));
                })()}
              </div>
              {selectedLocalRestaurant.center && (
                <div className="px-5 pt-4">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedLocalRestaurant.center.lat},${selectedLocalRestaurant.center.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 text-center text-sm font-medium text-stone-600 border border-stone-200 rounded-xl bg-stone-50 active:bg-stone-100"
                  >
                    {t(l, 'restaurant.googleMaps')}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && lightbox.images.length > 0 && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => { setLightbox(null); setLightboxLoading(false); }}
          onPrev={() => setLightbox((lb) => lb && { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length })}
          onNext={() => setLightbox((lb) => lb && { ...lb, index: (lb.index + 1) % lb.images.length })}
        />
      )}

      {/* 갤러리 로딩 중 — 이미지 아직 없을 때 */}
      {lightbox && lightbox.images.length === 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={() => { setLightbox(null); setLightboxLoading(false); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null); setLightboxLoading(false); }}
            className="absolute top-4 right-4 text-white/70 text-3xl leading-none"
          >×</button>
          {lightboxLoading
            ? <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <p className="text-white/50 text-sm">{t(l, 'gallery.noPhotos')}</p>
          }
        </div>
      )}
    </>
  );
}
