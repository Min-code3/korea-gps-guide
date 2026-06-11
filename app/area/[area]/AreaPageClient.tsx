'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Attraction, RestaurantPin } from '@/lib/types';
import type { SectorRow } from '@/lib/sheets';
import { t } from '@/lib/i18n';
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

export default function AreaPageClient({ area, lang, attractions, sectors, tagMap, center }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSectorMode, setIsSectorMode] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [detailAttr, setDetailAttr] = useState<Attraction | null>(null);
  const [restaurantPins, setRestaurantPins] = useState<RestaurantPin[]>([]);
  const [mode, setMode] = useState<'attractions' | 'events'>('attractions');

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

  const openLightbox = (images: string[], index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLightbox({ images, index });
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

        <div className="absolute bottom-4 right-4 z-50">
          <NearbyPanel
            selectedPin={attractions.find((a) => a.id === selectedId)?.center ?? null}
            lang={lang}
            onRestaurantsFound={setRestaurantPins}
          />
        </div>

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
          />
        </div>

        {/* 명소 / 행사 모드 탭 */}
        <div className="px-5 pt-3 pb-1 shrink-0 flex gap-2">
          <button
            onClick={() => setMode('attractions')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${mode === 'attractions' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
          >
            {lang === 'en' ? 'Attractions' : '명소'}
          </button>
          <button
            onClick={() => setMode('events')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${mode === 'events' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
          >
            {lang === 'en' ? 'Events' : '행사'}
          </button>
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

        {/* attraction list */}
        {mode === 'attractions' && <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-3 pt-1">
          {sectorAttractions.map((attraction) => {
            const isSelected = !isSectorMode && selectedId === attraction.id;
            const images = (attraction.images ?? []).map(toHttps);
            const thumb = images[0];
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
                            ...{lang === 'en' ? 'more' : '더보기'}
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
                    onClick={(e) => openLightbox(images, 0, e)}
                    onKeyDown={(e) => e.key === 'Enter' && openLightbox(images, 0, e as never)}
                    className="shrink-0 rounded-xl overflow-hidden cursor-pointer bg-stone-100 flex items-center justify-center text-stone-300 text-2xl"
                    style={{ width: 80, height: 80, minWidth: 80, maxWidth: 80, minHeight: 80, maxHeight: 80 }}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={attraction.name}
                        style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }}
                      />
                    ) : '🏛'}
                  </div>

                  <span className="text-amber-500 text-lg shrink-0 self-center">
                    {isSelected ? '→' : '›'}
                  </span>
                </div>
              </button>
            );
          })}
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

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((lb) => lb && { ...lb, index: (lb.index - 1 + lb.images.length) % lb.images.length })}
          onNext={() => setLightbox((lb) => lb && { ...lb, index: (lb.index + 1) % lb.images.length })}
        />
      )}
    </>
  );
}
