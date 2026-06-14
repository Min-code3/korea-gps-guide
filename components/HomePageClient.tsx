'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AreaRow } from '@/lib/sheets';
import ImageLightbox from '@/components/ImageLightbox';
import HomeEventsPanel from '@/components/HomeEventsPanel';
import { t, type Lang } from '@/lib/i18n';

interface Props {
  areas: AreaRow[];
  eventAreas: AreaRow[];
  coverImages: Record<string, string[]>;
  lang: string;
}

interface LightboxState { images: string[]; index: number; }

export default function HomePageClient({ areas, eventAreas, coverImages, lang }: Props) {
  const [mode, setMode] = useState<'attractions' | 'events'>('attractions');
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [thumbIndices, setThumbIndices] = useState<Record<string, number>>({});

  useEffect(() => {
    const indices: Record<string, number> = {};
    areas.forEach((area) => {
      const imgs = coverImages[area.area] ?? [];
      if (imgs.length > 0) indices[area.area] = Math.floor(Math.random() * imgs.length);
    });
    setThumbIndices(indices);
  }, [areas, coverImages]);

  const open = (images: string[], index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLightbox({ images, index });
  };

  const l = lang as Lang;
  const tabLabel = (key: 'attractions' | 'events') =>
    key === 'attractions' ? t(l, 'tab.attractions') : t(l, 'tab.events');

  return (
    <>
      {/* 명소 | 행사 탭 */}
      <div className="flex gap-2 mb-5">
        {(['attractions', 'events'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMode(tab)}
            className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              mode === tab
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-400 border border-stone-200'
            }`}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {mode === 'events' && <HomeEventsPanel eventAreas={eventAreas} lang={lang} />}

      {mode === 'attractions' && (
        <div className="flex flex-col gap-3">
          {areas.map((area) => {
            const images = coverImages[area.area] ?? [];
            const thumbIdx = thumbIndices[area.area] ?? 0;
            const thumb = images[thumbIdx];

            return (
              <div key={area.area} className="flex items-center bg-white rounded-2xl shadow-sm overflow-hidden">
                <Link
                  href={`/area/${encodeURIComponent(area.area)}?lang=${lang}`}
                  className="flex-1 min-w-0 px-5 py-5 active:bg-stone-50 transition-colors"
                >
                  <p className="text-xs text-amber-600 uppercase tracking-widest font-medium mb-1">{lang === 'en' ? (area.nationEn || area.nation) : area.nation}</p>
                  <p className="text-base font-bold text-stone-800">{lang === 'en' ? (area.areaEn || area.area) : area.area}</p>
                  {area.description && <p className="text-sm text-stone-400 mt-1">{area.description}</p>}
                </Link>

                {thumb ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => open(images, thumbIdx, e)}
                    onKeyDown={(e) => e.key === 'Enter' && open(images, thumbIdx, e as never)}
                    className="shrink-0 cursor-pointer"
                    style={{ width: 80, height: 80, minWidth: 80 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt={area.area} style={{ width: 80, height: 80, objectFit: 'cover', display: 'block' }} />
                  </div>
                ) : (
                  <div className="shrink-0 bg-stone-100 flex items-center justify-center text-stone-300 text-2xl" style={{ width: 80, height: 80, minWidth: 80 }}>🗺</div>
                )}
              </div>
            );
          })}
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
