'use client';

import { t, type Lang } from '@/lib/i18n';

function toHttps(url: string) {
  return url?.replace(/^http:\/\//i, 'https://') ?? '';
}

function formatDate(yyyymmdd: string): string {
  return `${parseInt(yyyymmdd.slice(4, 6))}.${parseInt(yyyymmdd.slice(6, 8))}`;
}

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

export interface EventDetailItem {
  title: string;
  firstimage?: string;
  eventstartdate: string;
  eventenddate: string;
  addr1: string;
  customNote?: string | null;
  detail?: {
    eventplace?: string | null;
    playtime?: string | null;
    usetimefestival?: string | null;
    tel?: string | null;
    homepage?: string | null;
  };
}

interface Props {
  event: EventDetailItem;
  lang: string;
  onClose: () => void;
}

export default function EventDetailSheet({ event, lang, onClose }: Props) {
  const l = lang as Lang;
  const d = event.detail ?? {};

  const rows = [
    { label: t(l, 'event.field.period'),  value: `${formatDate(event.eventstartdate)} ~ ${formatDate(event.eventenddate)}` },
    d.eventplace      && { label: t(l, 'event.field.venue'),   value: d.eventplace },
    { label: t(l, 'event.field.address'), value: event.addr1, copyable: true },
    d.playtime        && { label: t(l, 'event.field.hours'),   value: stripHtml(d.playtime) },
    d.usetimefestival && { label: t(l, 'event.field.fee'),     value: d.usetimefestival },
    d.tel             && { label: t(l, 'event.field.tel'),     value: d.tel },
    d.homepage        && { label: t(l, 'event.field.website'), value: d.homepage.replace(/<[^>]+>/g, '').trim() },
  ].filter(Boolean) as { label: string; value: string; copyable?: boolean }[];

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
          <p className="font-bold text-stone-800 text-sm truncate max-w-[80%]">{event.title}</p>
          <button onClick={onClose} className="text-stone-400 text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto pb-10">
          {event.firstimage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={toHttps(event.firstimage)} alt={event.title}
              className="w-full object-contain bg-stone-100" style={{ maxHeight: 240 }} />
          )}
          <div className="px-5 pt-4 flex flex-col gap-0">
            {rows.map(row => (
              <div key={row.label} className="flex gap-3 items-start py-2.5 border-b border-stone-100 last:border-0">
                <p className="text-xs text-stone-400 w-16 shrink-0 pt-0.5">{row.label}</p>
                <p className="text-sm text-stone-700 flex-1 whitespace-pre-line">{row.value}</p>
                {row.copyable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(row.value); }}
                    className="shrink-0 p-1 rounded text-stone-400 hover:text-amber-500 hover:bg-amber-50 active:text-amber-600 transition-colors"
                    title="Copy address"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {event.customNote && (
              <p className="text-xs text-amber-600 font-medium pt-3">{event.customNote}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
