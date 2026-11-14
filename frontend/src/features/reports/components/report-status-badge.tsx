'use client';

import { useTranslations } from 'next-intl';
import type { ReportStatus } from '../types';

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const t = useTranslations('reportStatus');

  return (
    <span
      className={`report-status report-status-${status.toLowerCase()}`}
    >
      <span
        aria-hidden
      />
      {t(status)}
    </span>
  );
}
