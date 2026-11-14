'use client';

import { useTranslations } from 'next-intl';
import type { ProductStatus } from '../types';

export function StatusBadge({ status }: { status: ProductStatus }) {
  const t = useTranslations('status');

  return (
    <span
      className={`status-badge status-${status.toLowerCase()}`}
    >
      <span
        aria-hidden
      />
      {t(status)}
    </span>
  );
}
