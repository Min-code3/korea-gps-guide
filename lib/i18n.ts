// ── 새 언어 추가 시 ───────────────────────────────────────────────────────
// 1. locales/ko.ts 를 복사해서 locales/[lang].ts 작성
// 2. 아래 import + messages 에 추가
// 3. Lang 타입에 해당 언어 코드 추가
// ─────────────────────────────────────────────────────────────────────────
import ko from '@/locales/ko';
import en from '@/locales/en';

const messages = { ko, en } as const;

export type Lang = 'ko' | 'en';  // ← 새 언어 추가 시 여기도 수정
export type MessageKey = keyof typeof ko;

/** 단순 번역 */
export function t(lang: Lang, key: MessageKey): string {
  return (messages[lang] as Record<string, string>)[key] ?? messages['ko'][key];
}

/** {param} 보간이 필요한 번역 — e.g. tp(lang, 'event.filter.month', { n: 3 }) */
export function tp(lang: Lang, key: MessageKey, params: Record<string, string | number>): string {
  const str = t(lang, key);
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    str,
  );
}
