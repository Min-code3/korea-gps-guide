'use client';

import { useState, useEffect, useMemo } from 'react';

interface FestivalItem {
  contentid: string;
  title: string;
  addr1: string;
  eventstartdate: string;
  eventenddate: string;
  firstimage: string;
  tel: string;
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

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:   { label: '진행중',   cls: 'bg-green-100 text-green-700' },
  soon:     { label: '곧 시작',  cls: 'bg-amber-100 text-amber-700' },
  ending:   { label: '마감임박', cls: 'bg-red-100 text-red-600' },
  upcoming: { label: 'D-예정',   cls: 'bg-stone-100 text-stone-500' },
};

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];

export default function EventList({ area, lang }: Props) {
  const [events, setEvents] = useState<FestivalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [filter, setFilter] = useState<string>('thisweek');
  const [selected, setSelected] = useState<FestivalItem | null>(null);
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);
  const year = today.getFullYear();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/events?area=${encodeURIComponent(area)}`)
      .then(r => r.json())
      .then(data => {
        setEvents(data.events ?? []);
        setSupported(data.supported ?? false);
      })
      .catch(() => setSupported(false))
      .finally(() => setLoading(false));
  }, [area]);

  const filtered = useMemo(() => {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndYMD = toYMD(weekEnd);

    return events.filter(e => {
      if (getStatus(e.eventstartdate, e.eventenddate, todayYMD) === 'ended') return false;
      if (filter === 'thisweek') {
        return e.eventstartdate <= weekEndYMD && e.eventenddate >= todayYMD;
      }
      const monthStart = `${year}${filter}01`;
      const monthEnd = `${year}${filter}31`;
      return e.eventstartdate <= monthEnd && e.eventenddate >= monthStart;
    });
  }, [events, filter, today, todayYMD, year]);

  const openDetail = async (event: FestivalItem) => {
    setSelected(event);
    setOverview(null);
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/event-detail?contentId=${event.contentid}`);
      const data = await res.json();
      setOverview(data.overview ? stripHtml(data.overview) : null);
    } catch {}
    setOverviewLoading(false);
  };

  const emptyMsg = filter === 'thisweek'
    ? (lang === 'en' ? 'No events this week.' : '이번주 행사가 없어요.')
    : (lang === 'en' ? `No events in ${parseInt(filter)} month.` : `${parseInt(filter)}월에 열리는 행사가 없어요.`);

  if (!supported) {
    return (
      <div className="flex-1 flex items-center justify-center px-5">
        <p className="text-sm text-stone-400 text-center">이 지역은 아직 행사 정보를 지원하지 않아요.</p>
      </div>
    );
  }

  return (
    <>
      {/* 드롭다운 */}
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
            <option value="thisweek">이번주</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={m}>{i + 1}월</option>
            ))}
          </select>
        </div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-5 pb-10 flex flex-col gap-3 pt-1">
        {loading && (
          <p className="text-sm text-stone-400 text-center py-8">불러오는 중...</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-stone-400 text-center py-8">{emptyMsg}</p>
        )}
        {filtered.map(event => {
          const status = getStatus(event.eventstartdate, event.eventenddate, todayYMD);
          const badge = STATUS_BADGE[status];
          return (
            <button
              key={event.contentid}
              className="w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden active:bg-stone-50"
              onClick={() => openDetail(event)}
            >
              {event.firstimage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toHttps(event.firstimage)} alt={event.title}
                  className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-24 bg-stone-100 flex items-center justify-center text-3xl text-stone-300">🎪</div>
              )}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                  <span className="text-xs text-stone-400">
                    {formatDate(event.eventstartdate)} ~ {formatDate(event.eventenddate)}
                  </span>
                </div>
                <p className="font-bold text-stone-800 text-sm">{event.title}</p>
                {event.addr1 && (
                  <p className="text-xs text-stone-400 mt-0.5 truncate">{event.addr1}</p>
                )}
              </div>
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
                  className="w-full h-44 object-cover" />
              )}
              <div className="px-5 pt-4 flex flex-col gap-0">
                {[
                  { label: '기간', value: `${formatDate(selected.eventstartdate)} ~ ${formatDate(selected.eventenddate)}` },
                  { label: '장소', value: selected.addr1 },
                  selected.tel ? { label: '전화', value: selected.tel } : null,
                ].filter(Boolean).map(row => row && (
                  <div key={row.label} className="flex gap-3 items-start py-2.5 border-b border-stone-100">
                    <p className="text-xs text-stone-400 w-12 shrink-0 pt-0.5">{row.label}</p>
                    <p className="text-sm text-stone-700 flex-1">{row.value}</p>
                  </div>
                ))}
                {overviewLoading ? (
                  <p className="text-sm text-stone-400 py-4 text-center">내용 불러오는 중...</p>
                ) : overview ? (
                  <p className="text-sm text-stone-600 leading-relaxed py-3 whitespace-pre-line">{overview}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
