'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/controls';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations();

  return (
    <section
      className="panel query-state"
      role="alert"
    >
      <AlertCircle
        size={38}
        aria-hidden
      />
      <h1>{t('navigationErrors.unexpected')}</h1>
      <p>{t('errors.unexpected')}</p>
      <Button
        onClick={reset}
      >{t('common.retry')}</Button>
    </section>
  );
}
