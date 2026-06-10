'use client';

import { useRouter, usePathname } from 'next/navigation';

export type Lang = 'ko' | 'en';

interface Props {
  lang?: Lang;
}

export default function LangToggle({ lang = 'ko' }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const toggle = (next: Lang) => {
    router.replace(`${pathname}?lang=${next}`);
    router.refresh();
  };

  return (
    <div className="relative flex items-center bg-stone-100 rounded-full p-0.5 text-xs font-medium">
      <span
        className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-white shadow-sm transition-transform duration-200 pointer-events-none"
        style={{ transform: lang === 'en' ? 'translateX(calc(100% + 4px))' : 'translateX(2px)' }}
      />
      <button
        onClick={() => toggle('ko')}
        className={`relative z-10 px-3 py-1.5 rounded-full transition-colors duration-200 ${lang === 'ko' ? 'text-stone-800' : 'text-stone-400'}`}
      >
        한국어
      </button>
      <button
        onClick={() => toggle('en')}
        className={`relative z-10 px-3 py-1.5 rounded-full transition-colors duration-200 ${lang === 'en' ? 'text-stone-800' : 'text-stone-400'}`}
      >
        English
      </button>
    </div>
  );
}
