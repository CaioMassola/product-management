'use client';

import { MoneyInput } from '@/components/ui/money-input';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  PackageSearch,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { ExportDialog } from '@/features/reports/components/export-dialog';
import { Link } from '@/i18n/navigation';
import {
  Button,
  Field,
  Input,
  PageHeading,
  Select,
  buttonClass,
} from '@/components/ui/controls';
import { ErrorState, LoadingState } from '@/components/ui/query-state';
import { useProducts } from '../queries';
import { PRODUCT_TYPES, type ProductFilters, type ProductType } from '../types';
import { validPriceRange } from '../validation';
import { StatusBadge } from './status-badge';
import { StatusAction } from './status-action';

const initialFilters: ProductFilters = {
  search: '',
  productType: '',
  status: 'ACTIVE',
  minPrice: '',
  maxPrice: '',
  page: 0,
  size: 25,
  sortBy: 'createdAt',
  direction: 'DESC',
};

export function ProductList() {
  const t = useTranslations();
  const format = useFormatter();
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timeout = setTimeout(
      () =>
        setFilters((current) =>
          current.search === search.trim()
            ? current
            : { ...current, search: search.trim(), page: 0 },
        ),
      350,
    );

    return () => clearTimeout(timeout);
  }, [search]);
  const valid = validPriceRange(filters.minPrice, filters.maxPrice);
  const query = useProducts(filters, valid);

  const setFilter = (values: Partial<ProductFilters>) =>
    setFilters((current) => ({ ...current, ...values, page: 0 }));

  const reset = () => {
    setSearch('');
    setFilters(initialFilters);
  };

  const sort = (field: ProductFilters['sortBy']) =>
    setFilter({
      sortBy: field,
      direction:
        filters.sortBy === field && filters.direction === 'ASC'
          ? 'DESC'
          : 'ASC',
    });

  const columns = [
    { key: 'title', label: 'products.name' },
    { key: 'code', label: 'products.code' },
    { key: 'productType', label: 'products.type' },
    { key: 'price', label: 'products.price' },
    { key: 'quantity', label: 'products.quantity' },
    { key: 'status', label: 'products.status' },
  ] as const;

  const data = query.data;
  const from = data && data.totalElements > 0 ? data.page * data.size + 1 : 0;

  const to = data
    ? Math.min((data.page + 1) * data.size, data.totalElements)
    : 0;

  const pageNumbers = data
    ? [
        ...new Set([
          0,
          Math.max(0, data.page - 1),
          data.page,
          Math.min(data.totalPages - 1, data.page + 1),
          data.totalPages - 1,
        ]),
      ]
        .filter((page) => page >= 0)
        .sort((a, b) => a - b)
    : [];

  return (
    <>
      <PageHeading
        title={t('products.title')}
        description={t('products.subtitle')}
        action={
          <Link
            href="/products/new"
            className={buttonClass()}
          >
            <Plus
              size={17}
            />
            {t('products.new')}
          </Link>
        }
      />
      <section
        className="panel filter-panel"
        aria-label={t('products.search')}
      >
        <div
          className="product-filter-grid"
        >
          <Field
            label={t('products.search')}
            id="product-search"
          >
            <div
              className="search-input"
            >
              <Search
                size={16}
                aria-hidden
              />
              <Input
                id="product-search"
                maxLength={200}
                placeholder={t('products.searchPlaceholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </Field>
          <Field
            label={t('products.type')}
            id="filter-type"
          >
            <Select
              id="filter-type"
              value={filters.productType}
              onChange={(event) =>
                setFilter({
                  productType: event.target.value as ProductType | '',
                })
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
            label={t('products.status')}
            id="filter-status"
          >
            <Select
              id="filter-status"
              value={filters.status}
              onChange={(event) =>
                setFilter({
                  status: event.target.value as ProductFilters['status'],
                })
              }
            >
              {(['ACTIVE', 'INACTIVE', 'ALL'] as const).map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {t(`status.${status}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('products.minPrice')}
            id="filter-min"
          >
            <MoneyInput
              id="filter-min"
              placeholder={format.number(0, { minimumFractionDigits: 2 })}
              value={filters.minPrice}
              aria-invalid={!valid}
              aria-describedby={!valid ? 'price-range-error' : undefined}
              onValueChange={(value) => setFilter({ minPrice: value })}
            />
          </Field>
          <Field
            label={t('products.maxPrice')}
            id="filter-max"
          >
            <MoneyInput
              id="filter-max"
              placeholder={t('products.noLimit')}
              value={filters.maxPrice}
              aria-invalid={!valid}
              aria-describedby={!valid ? 'price-range-error' : undefined}
              onValueChange={(value) => setFilter({ maxPrice: value })}
            />
          </Field>
        </div>
        <div
          className="filter-footer"
        >
          {!valid && (
            <p
              id="price-range-error"
              role="alert"
              className="field-error"
            >
              {t('products.invalidRange')}
            </p>
          )}
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
      </section>
      <section
        className="panel catalog-panel"
        aria-labelledby="catalog-title"
        aria-busy={query.isFetching}
      >
        <div
          className="catalog-heading"
        >
          <div>
            <h2
              id="catalog-title"
            >{t('products.catalog')}</h2>
            <p
              className="muted"
              aria-live="polite"
            >
              {t('products.count', { count: data?.totalElements ?? 0 })}
            </p>
          </div>
          <ExportDialog />
        </div>
        {!valid ? (
          <div
            className="query-state"
          >{t('products.invalidRange')}</div>
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
            <PackageSearch
              size={38}
              strokeWidth={1.4}
            />
            <h3>{t('products.empty')}</h3>
            <p>{t('products.emptyDescription')}</p>
            {filters.page > 0 ? (
              <Button
                variant="secondary"
                onClick={() => setFilter({})}
              >
                {t('common.first')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={reset}
              >
                {t('common.clear')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              className="table-scroll"
            >
              <table
                className="product-table"
              >
                <caption
                  className="sr-only"
                >{t('products.catalog')}</caption>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          filters.sortBy === column.key
                            ? filters.direction === 'ASC'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <button
                          onClick={() => sort(column.key)}
                          aria-label={t('common.sort', {
                            field: t(column.label),
                          })}
                        >
                          {t(column.label)}
                          {filters.sortBy === column.key ? (
                            filters.direction === 'ASC' ? (
                              <ArrowUp
                                size={12}
                              />
                            ) : (
                              <ArrowDown
                                size={12}
                              />
                            )
                          ) : (
                            <ArrowUpDown
                              size={12}
                            />
                          )}
                        </button>
                      </th>
                    ))}
                    <th
                      scope="col"
                    >{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.content.map((product) => (
                    <tr
                      key={product.id}
                    >
                      <td>
                        <Link
                          className="product-title"
                          href={`/products/${product.id}`}
                        >
                          {product.title}
                        </Link>
                      </td>
                      <td
                        className="product-code"
                      >{product.code}</td>
                      <td>{t(`types.${product.productType}`)}</td>
                      <td
                        className="numeric"
                      >
                        {format.number(product.price, {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td
                        className="numeric"
                      >
                        {format.number(product.quantity)}
                      </td>
                      <td>
                        <StatusBadge
                          status={product.status}
                        />
                      </td>
                      <td>
                        <div
                          className="row-actions"
                        >
                          <Link
                            className="icon-button"
                            href={`/products/${product.id}`}
                            aria-label={t('common.view')}
                            title={t('common.view')}
                          >
                            <Eye
                              size={16}
                            />
                          </Link>
                          <Link
                            className="icon-button"
                            href={`/products/${product.id}/edit`}
                            aria-label={t('common.edit')}
                            title={t('common.edit')}
                          >
                            <Pencil
                              size={15}
                            />
                          </Link>
                          <StatusAction
                            product={product}
                            compact
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && (
              <div
                className="table-footer"
              >
                <p>
                  {t('products.range', { from, to, total: data.totalElements })}
                </p>
                <div
                  className="pagination-controls"
                >
                  <label
                    className="page-size"
                  >
                    <span
                      className="sr-only"
                    >{t('common.perPage')}</span>
                    <Select
                      value={filters.size}
                      onChange={(event) =>
                        setFilter({ size: Number(event.target.value) })
                      }
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option
                          key={size}
                          value={size}
                        >
                          {size}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <nav
                    className="pagination"
                    aria-label={t('common.pagination')}
                  >
                    <button
                      className="icon-button"
                      disabled={data.page === 0 || query.isFetching}
                      onClick={() =>
                        setFilters({ ...filters, page: filters.page - 1 })
                      }
                      aria-label={t('common.previous')}
                    >
                      <ChevronLeft
                        size={17}
                      />
                    </button>
                    {pageNumbers.map((page, index) => (
                      <span
                        key={page}
                        className="page-number-group"
                      >
                        {index > 0 && page - pageNumbers[index - 1] > 1 && (
                          <span
                            className="pagination-ellipsis"
                            aria-hidden
                          >
                            …
                          </span>
                        )}
                        <button
                          className={`page-number ${page === data.page ? 'current' : ''}`}
                          aria-label={t('common.page', { page: page + 1 })}
                          aria-current={page === data.page ? 'page' : undefined}
                          disabled={query.isFetching}
                          onClick={() => setFilters({ ...filters, page })}
                        >
                          {page + 1}
                        </button>
                      </span>
                    ))}
                    <button
                      className="icon-button"
                      disabled={
                        data.page >= data.totalPages - 1 || query.isFetching
                      }
                      onClick={() =>
                        setFilters({ ...filters, page: filters.page + 1 })
                      }
                      aria-label={t('common.next')}
                    >
                      <ChevronRight
                        size={17}
                      />
                    </button>
                  </nav>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
