import { getAreas, getAreaCoverImages } from '@/lib/data';
import { t } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import HomePageClient from '@/components/HomePageClient';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang = 'ko' } = await searchParams;
  const [areas, coverImages] = await Promise.all([
    getAreas(),
    getAreaCoverImages(),
  ]);
  const eventAreas = areas
    .filter((a) => a.showEvents)
    .sort((a, b) => a.eventOrder - b.eventOrder);

  return (
    <main className="min-h-dvh bg-stone-50 px-5 pt-14 pb-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">{t(lang as 'ko' | 'en', 'home.title')}</h1>
          <p className="text-sm text-stone-400">{t(lang as 'ko' | 'en', 'home.subtitle')}</p>
        </div>
        <LangToggle lang={lang as 'ko' | 'en'} />
      </div>
      <HomePageClient areas={areas} eventAreas={eventAreas} coverImages={coverImages} lang={lang} />
    </main>
  );
}
