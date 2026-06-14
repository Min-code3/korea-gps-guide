'use client';

import { useState, useEffect, useMemo } from 'react';
import { t, tp, type Lang, type MessageKey } from '@/lib/i18n';

interface EventDetail {
  overview?: string | null;
  homepage?: string | null;
  tel?: string | null;
  playtime?: string | null;
  eventplace?: string | null;
  usetimefestival?: string | null;
  sponsor1?: string | null;
  sponsor1tel?: string | null;
}

interface FestivalItem {
  contentid: string;
  title: string;
  addr1: string;
  eventstartdate: string;
  eventenddate: string;
  firstimage: string;
  tel: string;
  detail?: EventDetail;
  customNote?: string | null;
}

interface Props {
  area: string;
  lang: string;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatDate(yyyymmdd: string): string {
  const m = parseInt(yyyymmdd.slice(4, 6));
  const d = parseInt(yyyymmdd.slice(6, 8));
  return `${m}.${d}`;
}

function toHttps(url: string) {
  return url?.replace(/^http:\/\//i, 'https://') ?? '';
}

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

function getStatus(start: string, end: string, todayYMD: string) {
  if (end < todayYMD) return 'ended';
  const msDay = 86400000;
  const todayMs = new Date(todayYMD.slice(0,4)+'-'+todayYMD.slice(4,6)+'-'+todayYMD.slice(6,8)).getTime();
  const endMs = new Date(end.slice(0,4)+'-'+end.slice(4,6)+'-'+end.slice(6,8)).getTime();
  if (start > todayYMD) {
    const startMs = new Date(start.slice(0,4)+'-'+start.slice(4,6)+'-'+start.slice(6,8)).getTime();
    const days = Math.ceil((startMs - todayMs) / msDay);
    return days <= 7 ? 'soon' : 'upcoming';
  }
  const daysLeft = Math.ceil((endMs - todayMs) / msDay);
  return daysLeft <= 3 ? 'ending' : 'active';
}

const STATUS_BADGE_KEY: Record<string, { labelKey: MessageKey; cls: string }> = {
  active:   { labelKey: 'event.badge.active',   cls: 'bg-green-100 text-green-700' },
  soon:     { labelKey: 'event.badge.soon',      cls: 'bg-amber-100 text-amber-700' },
  ending:   { labelKey: 'event.badge.ending',    cls: 'bg-red-100 text-red-600' },
  upcoming: { labelKey: 'event.badge.upcoming',  cls: 'bg-stone-100 text-stone-500' },
};

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];

export default function EventList({ area, lang }: Props) {
  const l = lang as Lang;
  const [events, setEvents] = useState<FestivalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [filter, setFilter] = useState<string>('thisweek');
  const [selected, setSelected] = useState<FestivalItem | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);
  const year = today.getFullYear();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/events?area=${encodeURIComponent(area)}&lang=${lang}`)
      .then(r => r.json())
      .then(data => {
        setEvents(data.events ?? []);
        setSupported(data.supported ?? false);
      })
      .catch(() => setSupported(false))
      .finally(() => setLoading(false));
  }, [area, lang]);

  const filtered = useMemo(() => {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndYMD = toYMD(weekEnd);

    return events.filter(e => {
      if (getStatus(e.eventstartdate, e.eventenddate, todayYMD) === 'ended') return false;
      if (filter === 'thisweek') {
        return e.eventstartdate <= weekEndYMD && e.eventenddate >= todayYMD;
      }
      if (filter === 'all') return true;
      const monthStart = `${year}${filter}01`;
      const monthEnd = `${year}${filter}31`;
      return e.eventstartdate <= monthEnd && e.eventenddate >= monthStart;
    });
  }, [events, filter, today, todayYMD, year]);

  const filterLabel = filter === 'thisweek'
    ? t(l, 'event.filter.thisweek')
    : filter === 'all'
    ? t(l, 'event.filter.all')
    : tp(l, 'event.filter.monthLabel', { n: parseInt(filter) });

  const emptyMsg = tp(l, 'event.empty', { filter: filterLabel });

  if (!supported) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <p className="text-sm text-stone-400 text-center">{t(l, 'event.unsupported')}</p>
      </div>
    );
  }

  return (
    <>
      {/* 필터 드롭다운 */}
      <div className="px-5 pt-2 pb-2 shrink-0">
        <div className="relative">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-700 bg-white pr-8"
            style={{
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23aaa' d='M5 6L0 0h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
            }}
          >
            <option value="thisweek">{t(l, 'event.filter.thisweek')}</option>
            <option value="all">{t(l, 'event.filter.allOption')}</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={m}>{tp(l, 'event.filter.month', { n: i + 1 })}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-3 pt-1">
        {loading && (
          <p className="text-sm text-stone-400 text-center py-8">{t(l, 'event.loading')}</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-8">{emptyMsg}</p>
        )}
        {filtered.map(event => {
          const status = getStatus(event.eventstartdate, event.eventenddate, todayYMD);
          const badge = STATUS_BADGE_KEY[status];
          return (
            <button
              key={event.contentid}
              className="w-full text-left bg-white rounded-2xl shadow-sm px-4 py-3 flex items-start gap-3 active:bg-stone-50"
              onClick={() => setSelected(event)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                      {t(l, badge.labelKey)}
                    </span>
                  )}
                  <span className="text-xs text-stone-400">
                    {formatDate(event.eventstartdate)} ~ {formatDate(event.eventenddate)}
                  </span>
                </div>
                <p className="font-bold text-stone-800 text-sm">{event.title}</p>
                {event.detail?.playtime && (
                  <p className="text-xs text-stone-500 mt-0.5 truncate">{stripHtml(event.detail.playtime)}</p>
                )}
                {event.customNote && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">{event.customNote}</p>
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
      </div>

      {/* 세부 팝업 */}
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
                    { label: t(l, 'event.field.period'),  value: `${formatDate(selected.eventstartdate)} ~ ${formatDate(selected.eventenddate)}` },
                    d.eventplace      && { label: t(l, 'event.field.venue'),   value: d.eventplace },
                    { label: t(l, 'event.field.address'), value: selected.addr1 },
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
    </>
  );
}
