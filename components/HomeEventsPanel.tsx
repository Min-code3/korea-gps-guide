'use client';

import { useState, useEffect, useRef } from 'react';
import { AreaRow } from '@/lib/sheets';
import { t, type Lang } from '@/lib/i18n';

interface EventDetail {
  overview?: string | null;
  eventplace?: string | null;
  usetimefestival?: string | null;
  playtime?: string | null;
}

interface Event {
  contentid: string;
  title: string;
  addr1?: string;
  firstimage?: string;
  eventstartdate?: string;
  eventenddate?: string;
  detail?: EventDetail;
  customNote?: string | null;
}

interface Props {
  eventAreas: AreaRow[];
  lang: string;
}

function fmtDate(d?: string): string {
  if (!d || d.length !== 8) return d ?? '';
  return `${parseInt(d.slice(4, 6))}.${parseInt(d.slice(6, 8))}`;
}

export default function HomeEventsPanel({ eventAreas, lang }: Props) {
  const l = lang as Lang;
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [cache, setCache] = useState<Record<string, Event[]>>({});
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  async function fetchArea(area: string) {
    if (fetchedRef.current.has(area)) return;
    fetchedRef.current.add(area);
    const res = await fetch(`/api/events?area=${encodeURIComponent(area)}&lang=${lang}`);
    const data = await res.json();
    setCache((prev) => ({ ...prev, [area]: data.events ?? [] }));
  }

  // Fetch all event areas on mount
  useEffect(() => {
    setLoading(true);
    Promise.all(eventAreas.map((a) => fetchArea(a.area))).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allEvents: Event[] = (() => {
    const seen = new Set<string>();
    const merged: Event[] = [];
    for (const a of eventAreas) {
      for (const e of cache[a.area] ?? []) {
        if (!seen.has(e.contentid)) {
          seen.add(e.contentid);
          merged.push(e);
        }
      }
    }
    return merged.sort((a, b) => (a.eventstartdate ?? '').localeCompare(b.eventstartdate ?? ''));
  })();

  const displayed = selectedArea === 'all' ? allEvents : (cache[selectedArea] ?? []);

  const tabs = [
    { key: 'all', label: t(l, 'tab.all') },
    ...eventAreas.map((a) => ({ key: a.area, label: lang === 'en' ? (a.areaEn || a.area) : a.area })),
  ];

  return (
    <div>
      {/* area sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedArea(tab.key)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedArea === tab.key
                ? 'bg-amber-500 text-white'
                : 'bg-white text-stone-500 border border-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && displayed.length === 0 ? (
        <div className="flex justify-center py-12 text-stone-400 text-sm">
          {t(l, 'event.home.loading')}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex justify-center py-12 text-stone-400 text-sm">
          {t(l, 'event.home.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((event) => (
            <div key={event.contentid} className="bg-white rounded-2xl shadow-sm overflow-hidden flex">
              {event.firstimage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.firstimage}
                  alt={event.title}
                  className="shrink-0 object-cover"
                  style={{ width: 80, height: 80 }}
                />
              ) : (
                <div className="shrink-0 bg-stone-100 flex items-center justify-center text-stone-300 text-2xl" style={{ width: 80, height: 80 }}>🎉</div>
              )}
              <div className="px-4 py-3 flex-1 min-w-0">
                <p className="font-semibold text-stone-800 text-sm leading-tight line-clamp-2">{event.title}</p>
                <p className="text-xs text-stone-400 mt-1">
                  {fmtDate(event.eventstartdate)} ~ {fmtDate(event.eventenddate)}
                </p>
                {(event.detail?.eventplace || event.addr1) && (
                  <p className="text-xs text-stone-400 truncate">
                    {event.detail?.eventplace || event.addr1}
                  </p>
                )}
                {event.customNote && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">{event.customNote}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
