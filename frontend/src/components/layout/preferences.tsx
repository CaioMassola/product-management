'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Globe2, Moon, Sun } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { PageHeading, Button } from '@/components/ui/controls';

const languages = [
  { locale: 'pt-BR', label: 'Português (Brasil)', code: 'PT' },
  { locale: 'en', label: 'English', code: 'EN' },
  { locale: 'es', label: 'Español', code: 'ES' },
];

const subscribeMounted = () => () => {};

export function Preferences() {
  const t = useTranslations('preferences');
  const locale = useLocale();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );

  return (
    <>
      <PageHeading
        title={t('title')}
        description={t('subtitle')}
      />
      <section
        className="panel preferences-panel"
      >
        <h2>
          <Globe2
            size={20}
          />
          {t('language')}
        </h2>
        <p
          className="muted"
        >{t('languageHelp')}</p>
        <fieldset
          className="language-options"
        >
          <legend
            className="sr-only"
          >{t('language')}</legend>
          {languages.map((language) => (
            <label
              key={language.locale}
              className={`language-option ${locale === language.locale ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="locale"
                value={language.locale}
                checked={locale === language.locale}
                onChange={() =>
                  router.replace('/settings', { locale: language.locale })
                }
              />
              <span
                lang={language.locale}
              >{language.label}</span>
              <small>{language.code}</small>
            </label>
          ))}
        </fieldset>
      </section>
      <section
        className="panel preferences-panel"
      >
        <h2>
          <Moon
            size={20}
          />
          {t('appearance')}
        </h2>
        <p
          className="muted"
        >{t('appearanceHelp')}</p>
        <div
          className="theme-options"
        >
          <Button
            variant="secondary"
            aria-pressed={mounted && resolvedTheme === 'light'}
            onClick={() => setTheme('light')}
          >
            <Sun
              size={16}
            />
            {t('light')}
          </Button>
          <Button
            variant="secondary"
            aria-pressed={mounted && resolvedTheme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <Moon
              size={16}
            />
            {t('dark')}
          </Button>
        </div>
      </section>
    </>
  );
}
