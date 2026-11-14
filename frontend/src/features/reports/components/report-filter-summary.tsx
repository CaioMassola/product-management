'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { ReportFilters } from '../types';

export function ReportFilterSummary({ filters }: { filters: ReportFilters }) {
  const t = useTranslations();
  const format = useFormatter();

  const parts = [
    filters.productType ? t(`types.${filters.productType}`) : null,
    filters.productStatus ? t(`status.${filters.productStatus}`) : null,
    filters.minPrice != null
      ? t('reportCenter.minimum', {
          amount: format.number(filters.minPrice, {
            style: 'currency',
            currency: 'BRL',
          }),
        })
      : null,
    filters.maxPrice != null
      ? t('reportCenter.maximum', {
          amount: format.number(filters.maxPrice, {
            style: 'currency',
            currency: 'BRL',
          }),
        })
      : null,
  ].filter(Boolean);

  return (
    <span
      className="report-filter-summary"
    >
      {parts.length ? parts.join(' · ') : t('reportCenter.allProducts')}
    </span>
  );
}
