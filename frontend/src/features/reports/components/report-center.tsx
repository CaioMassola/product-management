'use client';

import { MoneyInput } from '@/components/ui/money-input';

import { useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileSearch,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  Button,
  Field,
  Input,
  PageHeading,
  Select,
} from '@/components/ui/controls';
import { Pagination } from '@/components/ui/pagination';
import { ErrorState, LoadingState } from '@/components/ui/query-state';
import {
  PRODUCT_TYPES,
  type ProductStatus,
  type ProductType,
} from '@/features/products/types';
import { validPriceRange } from '@/features/products/validation';
import {
  REPORT_STATUSES,
  type Report,
  type ReportListFilters,
  type ReportStatus,
} from '../types';
import { useReports } from '../queries';
import { requestDateRange } from '../date-range';
import { reportDownloadUrl } from '../api';
import { ExportDialog } from './export-dialog';
import { ReportStatusBadge } from './report-status-badge';
import { ReportFilterSummary } from './report-filter-summary';
import { ReportDetailsDialog } from './report-details-dialog';

const initialFilters: ReportListFilters = {
  name: '',
  status: '',
  productType: '',
  productStatus: '',
  minPrice: '',
  maxPrice: '',
  requestedFrom: '',
  requestedTo: '',
  page: 0,
  size: 25,
  sortBy: 'requestedAt',
  direction: 'DESC',
};

export function ReportCenter() {
  const t = useTranslations();
  const format = useFormatter();
  const [filters, setFilters] = useState(initialFilters);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);
  const detailsTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((current) =>
          current.name === name.trim()
            ? current
            : { ...current, name: name.trim(), page: 0 },
        ),
      350,
    );

    return () => clearTimeout(timer);
  }, [name]);
  const dates = requestDateRange(from, to);
  const pricesValid = validPriceRange(filters.minPrice, filters.maxPrice);

  const query = useReports(
    { ...filters, ...(dates ?? { requestedFrom: '', requestedTo: '' }) },
    pricesValid && Boolean(dates),
  );

  const data = query.data;

  const update = (values: Partial<ReportListFilters>) =>
    setFilters((current) => ({ ...current, ...values, page: 0 }));

  const reset = () => {
    setName('');
    setFrom('');
    setTo('');
    setFilters(initialFilters);
  };

  const sort = (field: ReportListFilters['sortBy']) =>
    update({
      sortBy: field,
      direction:
        filters.sortBy === field && filters.direction === 'ASC'
          ? 'DESC'
          : 'ASC',
    });

  const sortHeading = (field: ReportListFilters['sortBy'], label: string) => (
    <th
      scope="col"
      aria-sort={
        filters.sortBy === field
          ? filters.direction === 'ASC'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <button
        onClick={() => sort(field)}
        aria-label={t('common.sort', { field: label })}
      >
        {label}
        {filters.sortBy !== field ? (
          <ArrowUpDown
            size={12}
          />
        ) : filters.direction === 'ASC' ? (
          <ArrowUp
            size={12}
          />
        ) : (
          <ArrowDown
            size={12}
          />
        )}
      </button>
    </th>
  );

  return (
    <>
      <PageHeading
        title={t('reportCenter.title')}
        description={t('reportCenter.subtitle')}
        action={<ExportDialog
          fromReports
                />}
      />
      <section
        className="panel report-filter-panel"
        aria-label={t('reportCenter.searchFilters')}
      >
        <div
          className="report-filter-top"
        >
          <Field
            label={t('reportCenter.name')}
            id="report-name"
          >
            <div
              className="search-input"
            >
              <Search
                size={15}
                aria-hidden
              />
              <Input
                id="report-name"
                maxLength={200}
                value={name}
                placeholder="PRODUCT_REPORT_…"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </Field>
          <Field
            label={t('reportCenter.processing')}
            id="report-processing"
          >
            <Select
              id="report-processing"
              value={filters.status}
              onChange={(event) =>
                update({ status: event.target.value as ReportStatus | '' })
              }
            >
              <option
                value=""
              >{t('reportCenter.allStatuses')}</option>
              {REPORT_STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {t(`reportStatus.${status}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('reports.productType')}
            id="report-product-type"
          >
            <Select
              id="report-product-type"
              value={filters.productType}
              onChange={(event) =>
                update({ productType: event.target.value as ProductType | '' })
              }
            >
              <option
                value=""
              >{t('products.allTypes')}</option>
              {PRODUCT_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {t(`types.${type}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('reports.productStatus')}
            id="report-product-status"
          >
            <Select
              id="report-product-status"
              value={filters.productStatus}
              onChange={(event) =>
                update({
                  productStatus: event.target.value as ProductStatus | '',
                })
              }
            >
              <option
                value=""
              >{t('common.all')}</option>
              <option
                value="ACTIVE"
              >{t('status.ACTIVE')}</option>
              <option
                value="INACTIVE"
              >{t('status.INACTIVE')}</option>
            </Select>
          </Field>
        </div>
        <div
          className="report-filter-bottom"
        >
          <Field
            label={t('reportCenter.minPrice')}
            id="report-min-price"
          >
            <MoneyInput
              id="report-min-price"
              value={filters.minPrice}
              placeholder={format.number(0, { minimumFractionDigits: 2 })}
              aria-invalid={!pricesValid}
              aria-describedby={!pricesValid ? 'report-price-error' : undefined}
              onValueChange={(value) => update({ minPrice: value })}
            />
          </Field>
          <Field
            label={t('reportCenter.maxPrice')}
            id="report-max-price"
          >
            <MoneyInput
              id="report-max-price"
              value={filters.maxPrice}
              placeholder={t('products.noLimit')}
              aria-invalid={!pricesValid}
              aria-describedby={!pricesValid ? 'report-price-error' : undefined}
              onValueChange={(value) => update({ maxPrice: value })}
            />
          </Field>
          <fieldset
            className="report-period"
          >
            <legend>{t('reportCenter.requestDate')}</legend>
            <div>
              <label
                className="sr-only"
                htmlFor="report-date-from"
              >
                {t('reportCenter.fromDate')}
              </label>
              <Input
                id="report-date-from"
                type="date"
                value={from}
                aria-invalid={!dates}
                aria-describedby={!dates ? 'report-date-error' : undefined}
                onChange={(event) => {
                  setFrom(event.target.value);
                  update({});
                }}
              />
              <span
                aria-hidden
              >–</span>
              <label
                className="sr-only"
                htmlFor="report-date-to"
              >
                {t('reportCenter.toDate')}
              </label>
              <Input
                id="report-date-to"
                type="date"
                value={to}
                aria-invalid={!dates}
                aria-describedby={!dates ? 'report-date-error' : undefined}
                onChange={(event) => {
                  setTo(event.target.value);
                  update({});
                }}
              />
            </div>
          </fieldset>
          <Button
            variant="ghost"
            onClick={reset}
          >
            <RotateCcw
              size={14}
            />
            {t('common.clear')}
          </Button>
        </div>
        {!pricesValid && (
          <p
            id="report-price-error"
            className="field-error"
            role="alert"
          >
            {t('products.invalidRange')}
          </p>
        )}
        {!dates && (
          <p
            id="report-date-error"
            className="field-error"
            role="alert"
          >
            {t('reportCenter.invalidDates')}
          </p>
        )}
      </section>
      <section
        className="panel report-history-panel"
        aria-labelledby="report-history-heading"
        aria-busy={query.isFetching}
      >
        <div
          className="report-history-heading"
        >
          <h2
            id="report-history-heading"
          >{t('reportCenter.history')}</h2>
          <p
            className="muted"
            aria-live="polite"
          >
            {t('reportCenter.count', { count: data?.totalElements ?? 0 })}
          </p>
        </div>
        {!pricesValid || !dates ? (
          <div
            className="query-state"
          >{t('reportCenter.adjustFilters')}</div>
        ) : query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            retry={() => void query.refetch()}
          />
        ) : data && data.content.length === 0 ? (
          <div
            className="query-state empty-state"
          >
            <FileSearch
              size={36}
              strokeWidth={1.5}
            />
            <h3>{t('reportCenter.empty')}</h3>
            <p>{t('reportCenter.emptyHelp')}</p>
            <Button
              variant="secondary"
              onClick={() => (filters.page > 0 ? update({}) : reset())}
            >
              {t(filters.page > 0 ? 'common.first' : 'common.clear')}
            </Button>
          </div>
        ) : (
          <>
            <div
              className="table-scroll"
            >
              <table
                className="report-table"
              >
                <caption
                  className="sr-only"
                >
                  {t('reportCenter.history')}
                </caption>
                <thead>
                  <tr>
                    {sortHeading('filename', t('reportCenter.report'))}
                    {sortHeading('requestedAt', t('reportCenter.requestedAt'))}
                    <th
                      scope="col"
                    >{t('reportCenter.filters')}</th>
                    {sortHeading('status', t('reportCenter.processing'))}
                    <th
                      scope="col"
                    >{t('reportCenter.file')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.content.map((report) => (
                    <tr
                      key={report.id}
                    >
                      <td>
                        <button
                          className="report-name-button"
                          aria-label={t('reportCenter.viewDetails', {
                            name: report.filename,
                          })}
                          onClick={(event) => {
                            detailsTrigger.current = event.currentTarget;
                            setSelected(report);
                          }}
                        >
                          {report.filename}
                        </button>
                      </td>
                      <td
                        className="report-date-cell"
                      >
                        {format.dateTime(new Date(report.requestedAt), {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone:
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                        })}
                      </td>
                      <td>
                        <ReportFilterSummary
                          filters={report.filters}
                        />
                      </td>
                      <td>
                        <ReportStatusBadge
                          status={report.status}
                        />
                        {report.status === 'FAILED' && (
                          <p
                            className="report-row-error"
                          >
                            {t('reports.failedHelp')}
                          </p>
                        )}
                      </td>
                      <td>
                        {report.status === 'COMPLETED' &&
                        report.downloadAvailable ? (
                          <a
                            className="report-download"
                            href={reportDownloadUrl(report.id)}
                            download={report.filename}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download
                              size={14}
                            />
                            {t('reportCenter.xlsx')}
                          </a>
                        ) : (
                          <span
                            className="report-file-unavailable"
                            aria-label={t('reportCenter.downloadUnavailable')}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && (
              <Pagination
                page={data.page}
                size={data.size}
                totalElements={data.totalElements}
                totalPages={data.totalPages}
                busy={query.isFetching}
                onPageChange={(page) => setFilters({ ...filters, page })}
                onSizeChange={(size) => update({ size })}
              />
            )}
          </>
        )}
      </section>
      {selected && (
        <ReportDetailsDialog
          report={selected}
          close={() => setSelected(null)}
          restoreFocus={() => {
            if (detailsTrigger.current?.isConnected)
              detailsTrigger.current.focus();
            else document.getElementById('main-content')?.focus();
          }}
        />
      )}
    </>
  );
}
