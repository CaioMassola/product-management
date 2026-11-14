'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { errorKey } from '@/lib/api-client';
import { Button } from './controls';

export function LoadingState() {
  const t = useTranslations('common');

  return (
    <div
      className="query-state"
      role="status"
    >
      <LoaderCircle
        size={24}
        className="animate-spin"
      />
      <span>{t('loading')}</span>
    </div>
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useTranslations();

  return (
    <div
      className="query-state"
      role="alert"
    >
      <AlertCircle
        size={28}
      />
      <p>{t(`errors.${errorKey(error)}`)}</p>
      <Button
        variant="secondary"
        onClick={retry}
      >
        {t('common.retry')}
      </Button>
    </div>
  );
}
