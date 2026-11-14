'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Globe2 } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTransition } from 'react';

export function LanguageSelect() {
  const locale = useLocale();
  const t = useTranslations('preferences');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="language-select header-control"
    >
      <Globe2
        size={15}
        aria-hidden
      />
      <select
        aria-label={t('selectLanguage')}
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const nextLocale = event.target.value;
          startTransition(() =>
            router.replace(pathname + window.location.search, {
              locale: nextLocale,
            }),
          );
        }}
      >
        <option
          value="pt-BR"
        >PT</option>
        <option
          value="en"
        >EN</option>
        <option
          value="es"
        >ES</option>
      </select>
    </div>
  );
}
