'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const t = useTranslations('preferences');

  return (
    <button
      className="header-control"
      aria-label={t('switchTheme')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <span
        className="light-only inline-flex items-center gap-2"
      >
        <Moon
          size={15}
        />
        {t('dark')}
      </span>
      <span
        className="dark-only items-center gap-2"
      >
        <Sun
          size={15}
        />
        {t('light')}
      </span>
    </button>
  );
}
