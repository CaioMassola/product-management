'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from './controls';

export function Pagination({
  page,
  size,
  totalElements,
  totalPages,
  busy,
  onPageChange,
  onSizeChange,
}: {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  busy: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
}) {
  const t = useTranslations('common');
  const format = useFormatter();

  const pages = [
    ...new Set([
      0,
      Math.max(0, page - 1),
      page,
      Math.min(totalPages - 1, page + 1),
      totalPages - 1,
    ]),
  ]
    .filter((value) => value >= 0)
    .sort((a, b) => a - b);

  return (
    <div
      className="table-footer"
    >
      <p>
        {t('resultRange', {
          from: totalElements ? page * size + 1 : 0,
          to: Math.min((page + 1) * size, totalElements),
          total: totalElements,
        })}
      </p>
      <div
        className="pagination-controls"
      >
        <label
          className="page-size"
        >
          <span
            className="sr-only"
          >{t('perPage')}</span>
          <Select
            value={size}
            disabled={busy}
            onChange={(event) => onSizeChange(Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((value) => (
              <option
                key={value}
                value={value}
              >
                {format.number(value)}
              </option>
            ))}
          </Select>
        </label>
        <nav
          className="pagination"
          aria-label={t('pagination')}
        >
          <button
            className="icon-button"
            disabled={page === 0 || busy}
            onClick={() => onPageChange(page - 1)}
            aria-label={t('previous')}
          >
            <ChevronLeft
              size={17}
            />
          </button>
          {pages.map((number, index) => (
            <span
              key={number}
              className="page-number-group"
            >
              {index > 0 && number - pages[index - 1] > 1 && (
                <span
                  className="pagination-ellipsis"
                  aria-hidden
                >
                  …
                </span>
              )}
              <button
                className={`page-number ${number === page ? 'current' : ''}`}
                disabled={busy}
                aria-label={t('page', { page: number + 1 })}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => onPageChange(number)}
              >
                {format.number(number + 1)}
              </button>
            </span>
          ))}
          <button
            className="icon-button"
            disabled={page >= totalPages - 1 || busy}
            onClick={() => onPageChange(page + 1)}
            aria-label={t('next')}
          >
            <ChevronRight
              size={17}
            />
          </button>
        </nav>
      </div>
    </div>
  );
}
