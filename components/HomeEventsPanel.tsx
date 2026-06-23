'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { AreaRow } from '@/lib/sheets';
import { t, type Lang } from '@/lib/i18n';
import { trackEventDetailOpened } from '@/lib/analytics';

interface EventDetail {
  overview?: string | null;
  homepage?: string | null;
  tel?: string | null;
  playtime?: string | null;
  eventplace?: string | null;
  usetimefestival?: string | null;
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

function toHttps(url: string) {
  return url?.replace(/^http:\/\//i, 'https://') ?? '';
}

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

export default function HomeEventsPanel({ eventAreas, lang }: Props) {
  const l = lang as Lang;
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [cache, setCache] = useState<Record<string, Event[]>>({});
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());
  const [selected, setSelected] = useState<Event | null>(null);

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

  const areaFiltered = selectedArea === 'all' ? allEvents : (cache[selectedArea] ?? []);

  // 이벤트에 존재하는 월만 추출 (오름차순)
  const activeMonths = useMemo(() => {
    const set = new Set<string>();
    areaFiltered.forEach((e) => {
      if (e.eventstartdate && e.eventstartdate.length >= 6) set.add(e.eventstartdate.slice(4, 6));
    });
    return Array.from(set).sort();
  }, [areaFiltered]);

  const displayed = selectedMonth === 'all'
    ? areaFiltered
    : areaFiltered.filter((e) => e.eventstartdate?.slice(4, 6) === selectedMonth);

  const monthLabel = (mm: string) => {
    const m = parseInt(mm);
    const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return lang === 'en' ? EN_MONTHS[m - 1] : `${m}월`;
  };

  const areaTabs = [
    { key: 'all', label: t(l, 'tab.all') },
    ...eventAreas.map((a) => ({ key: a.area, label: lang === 'en' ? (a.areaEn || a.area) : a.area })),
  ];

  return (
    <div>
      {/* area sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
        {areaTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setSelectedArea(tab.key); setSelectedMonth('all'); }}
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

      {/* month sub-tabs — 이벤트가 있는 월만 표시 */}
      {activeMonths.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
          <button
            onClick={() => setSelectedMonth('all')}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selectedMonth === 'all'
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-400 border border-stone-200'
            }`}
          >
            {t(l, 'tab.all')}
          </button>
          {activeMonths.map((mm) => (
            <button
              key={mm}
              onClick={() => setSelectedMonth(mm)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedMonth === mm
                  ? 'bg-stone-800 text-white'
                  : 'bg-white text-stone-400 border border-stone-200'
              }`}
            >
              {monthLabel(mm)}
            </button>
          ))}
        </div>
      )}

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
            <button
              key={event.contentid}
              className="w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden flex active:bg-stone-50"
              onClick={() => { setSelected(event); trackEventDetailOpened(selectedArea, event.title, 'home', lang); }}
            >
              {event.firstimage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toHttps(event.firstimage)}
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
              <span className="text-amber-500 text-lg shrink-0 self-center pr-3">›</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
              <p className="font-bold text-stone-800 text-sm truncate max-w-[80%]">{selected.title}</p>
              <button onClick={() => setSelected(null)} className="text-stone-400 text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto pb-10">
              {selected.firstimage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toHttps(selected.firstimage)} alt={selected.title}
                  className="w-full object-contain bg-stone-100" style={{ maxHeight: 240 }} />
              )}
              <div className="px-5 pt-4 flex flex-col gap-0">
                {(() => {
                  const d = selected.detail ?? {};
                  const rows = [
                    { label: t(l, 'event.field.period'),  value: `${fmtDate(selected.eventstartdate)} ~ ${fmtDate(selected.eventenddate)}` },
                    d.eventplace      && { label: t(l, 'event.field.venue'),   value: d.eventplace },
                    selected.addr1    && { label: t(l, 'event.field.address'), value: selected.addr1 },
                    d.playtime        && { label: t(l, 'event.field.hours'),   value: stripHtml(d.playtime) },
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
                {selected.customNote && (
                  <p className="text-xs text-amber-600 font-medium pt-3">{selected.customNote}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
