const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// 빈 문자열·null 제외하고 번역, 원래 순서·빈값 유지
// 번역 결과는 Vercel 서버에 24시간 캐시 → 같은 텍스트는 하루에 1회만 과금
export async function translateBatch(texts: (string | null | undefined)[], target = 'en', source = 'ko'): Promise<string[]> {
  const KEY = process.env.GOOGLE_TRANSLATE_API_KEY!;
  const filled = texts.map(t => t?.trim() || '');
  const toTranslate = filled.filter(Boolean);
  if (!toTranslate.length) return filled;

  const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: toTranslate, source, target, format: 'text' }),
    next: { revalidate: 86400 },
  });
  let data: { data?: { translations?: { translatedText: string }[] }; error?: { message: string } };
  try {
    data = await res.json();
  } catch {
    return filled;
  }
  if (data.error) {
    console.error('[translate] API error:', data.error.message);
    return filled;
  }
  const results: string[] = data.data?.translations?.map(
    (t: { translatedText: string }) => t.translatedText.replace(/\n{2,}/g, '\n').trim()
  ) ?? toTranslate;

  // 빈 항목 원위치 복원
  let idx = 0;
  return filled.map(t => t ? (results[idx++] ?? t) : '');
}
