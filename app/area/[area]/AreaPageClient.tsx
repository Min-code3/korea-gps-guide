'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Attraction, RestaurantPin } from '@/lib/types';
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

export default function AreaPageClient({ area, lang, attractions, sectors, tagMap, center }: Props) {
  const l = lang as Lang;
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSectorMode, setIsSectorMode] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [lightboxLoading, setLightboxLoading] = useState(false);
  const [galleryCache, setGalleryCache] = useState<Record<string, string[]>>({});
  const [detailAttr, setDetailAttr] = useState<Attraction | null>(null);
  const [restaurantPins, setRestaurantPins] = useState<RestaurantPin[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [mode, setMode] = useState<'attractions' | 'restaurants' | 'events'>('attractions');
  const [areaEvents, setAreaEvents] = useState<SectorEventItem[]>([]);
  const [selectedSectorEvent, setSelectedSectorEvent] = useState<SectorEventItem | null>(null);
  const todayYMD = useMemo(() => toYMD(new Date()), []);

  useEffect(() => {
    fetch(`/api/events?area=${encodeURIComponent(area)}&lang=${lang}`)
      .then(r => r.json())
      .then(data => setAreaEvents(data.events ?? []))
      .catch(() => {});
  }, [area, lang]);

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

  const sectorAttractions = useMemo(
    () =>
      activeSector
        ? attractions.filter((a) => a.sector === activeSector)
        : attractions,
    [attractions, activeSector]
  );

  const sectorIds = useMemo(
    () => sectorAttractions.map((a) => a.id),
    [sectorAttractions]
  );

  const handleCardTap = (attractionId: string) => {
    if (!isSectorMode && selectedId === attractionId) {
      router.push(`/guide/${attractionId}?lang=${lang}`);
    } else {
      setIsSectorMode(false);
      setSelectedId(attractionId);
    }
  };

  const handlePinClick = (attractionId: string) => {
    const attr = attractions.find((a) => a.id === attractionId);
    if (attr?.sector) setActiveSector(attr.sector);
    setIsSectorMode(false);
    setSelectedId(attractionId);
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
            attractions={attractions}
            center={center}
            defaultZoom={13}
            selectedId={selectedId}
            sectorIds={sectorIds}
            isSectorMode={isSectorMode}
            onPinClick={handlePinClick}
            restaurantPins={restaurantPins}
            selectedRestaurantId={selectedRestaurantId}
            onRestaurantPinClick={setSelectedRestaurantId}
            lang={lang}
          />
        </div>

        {/* 명소 / 식당 / 행사 모드 탭 */}
        <div className="px-5 pt-3 pb-1 shrink-0 flex gap-2">
          {(['attractions', 'restaurants', 'events'] as const).map((m) => {
            const labelKey = m === 'attractions' ? 'tab.attractions' : m === 'restaurants' ? 'tab.restaurants' : 'tab.events';
            const label = t(l, labelKey as MessageKey);
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${mode === m ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
              >
                {label}
              </button>
            );
          })}
        </div>

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
                    const first = attractions.find((a) => a.sector === s.sectorKo);
                    setSelectedId(first?.id ?? null);
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
          <NearbyPanel
            inline
            selectedPin={attractions.find((a) => a.id === selectedId)?.center ?? null}
            lang={lang}
            onRestaurantsFound={setRestaurantPins}
            highlightedId={selectedRestaurantId}
          />
        )}

        {/* attraction list */}
        {mode === 'attractions' && <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-3 pt-1">
          {sectorAttractions.map((attraction) => {
            const isSelected = !isSectorMode && selectedId === attraction.id;
            const images = (attraction.images ?? []).map(toHttps);
            const cached = attraction.contentId ? (galleryCache[attraction.contentId] ?? []) : [];
            const thumb = images[0] || cached[0];
            const tagBadges = (attraction.tags ?? []).filter((tag) => tagMap[tag]);
            const desc = attraction.description ?? '';
            const shortDesc = desc.length > DESC_LIMIT ? desc.slice(0, DESC_LIMIT) : desc;
            const hasMore = desc.length > DESC_LIMIT;

            return (
              <button
                key={attraction.id}
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
                      <p className="text-xs text-stone-400 mt-1">🎫 {attraction.admission}</p>
                    )}

                    {/* hours */}
                    {attraction.hours && (
                      <p className="text-xs text-stone-400 mt-0.5">⏰ {attraction.hours}</p>
                    )}

                    {isSelected && (
                      <p className="text-xs text-amber-600 mt-2 font-medium">
                        {t(lang as 'ko' | 'en', 'tapAgain')}
                      </p>
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
