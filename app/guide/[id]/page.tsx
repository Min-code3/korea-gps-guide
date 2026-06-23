import { notFound } from 'next/navigation';
import { getAttractionById } from '@/lib/data';
import GuidePageClient from './GuidePageClient';

export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ id }, { lang = 'en' }] = await Promise.all([params, searchParams]);
  const attraction = await getAttractionById(id, lang as 'ko' | 'en');
  if (!attraction) return notFound();
  return <GuidePageClient attraction={attraction} lang={lang as 'ko' | 'en'} />;
}
