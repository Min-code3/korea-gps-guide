const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// 빈 문자열·null 제외하고 번역, 원래 순서·빈값 유지
// 번역 결과는 Vercel 서버에 24시간 캐시 → 같은 텍스트는 하루에 1회만 과금
export async function translateBatch(texts: (string | null | undefined)[], target = 'en', source = 'ko'): Promise<string[]> {
  const KEY = process.env.GOOGLE_TRANSLATE_API_KEY!;
  const filled = texts.map(t => t?.trim() || '');
  const toTranslate = filled.filter(Boolean);
  if (!toTranslate.length) return filled;

  const qs = new URLSearchParams({ key: KEY, source, target, format: 'text' });
  toTranslate.forEach(t => qs.append('q', t));

  const res = await fetch(`${ENDPOINT}?${qs}`, { next: { revalidate: 86400 } });
  let data: { data?: { translations?: { translatedText: string }[] } };
  try {
    data = await res.json();
  } catch {
    return filled; // 번역 API 오류 시 원문 반환
  }
  const results: string[] = data.data?.translations?.map(
    (t: { translatedText: string }) => t.translatedText.replace(/\n{2,}/g, '\n').trim()
  ) ?? toTranslate;

  // 빈 항목 원위치 복원
  let idx = 0;
  return filled.map(t => t ? (results[idx++] ?? t) : '');
}
