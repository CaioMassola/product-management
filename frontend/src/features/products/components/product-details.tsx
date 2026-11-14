'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { ArrowLeft, Package, Pencil } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonClass, PageHeading } from '@/components/ui/controls';
import { ErrorState, LoadingState } from '@/components/ui/query-state';
import { useProduct } from '../queries';
import { productImageUrl } from '../api';
import { StatusBadge } from './status-badge';
import { StatusAction } from './status-action';
import { ProductImage } from './product-image';

export function ProductDetails({ id }: { id: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const query = useProduct(id);
  const product = query.data;

  return (
    <>
      <Link
        className="back-link"
        href="/products"
      >
        <ArrowLeft
          size={16}
        />
        {t('common.back')}
      </Link>
      <PageHeading
        title={product?.title ?? t('products.details')}
        description={product?.code ?? ''}
        action={
          product && (
            <Link
              className={buttonClass()}
              href={`/products/${id}/edit`}
            >
              <Pencil
                size={16}
              />
              {t('common.edit')}
            </Link>
          )
        }
      />
      <section
        className="panel details-panel"
      >
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            retry={() => void query.refetch()}
          />
        ) : (
          product && (
            <>
              <div
                className="detail-image"
              >
                {product.imageKey ? (
                  <ProductImage
                    key={product.updatedAt}
                    src={productImageUrl(product)}
                    alt={t('form.imageAlt', { title: product.title })}
                  />
                ) : (
                  <Package
                    size={64}
                    strokeWidth={1}
                  />
                )}
              </div>
              <div
                className="detail-information"
              >
                <div
                  className="detail-status"
                >
                  <StatusBadge
                    status={product.status}
                  />
                  <StatusAction
                    product={product}
                  />
                </div>
                <dl
                  className="detail-grid"
                >
                  <div>
                    <dt>{t('products.code')}</dt>
                    <dd>{product.code}</dd>
                  </div>
                  <div>
                    <dt>{t('products.type')}</dt>
                    <dd>{t(`types.${product.productType}`)}</dd>
                  </div>
                  <div>
                    <dt>{t('products.price')}</dt>
                    <dd
                      className="detail-price"
                    >
                      {format.number(product.price, {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('products.quantity')}</dt>
                    <dd>{format.number(product.quantity)}</dd>
                  </div>
                  <div>
                    <dt>{t('products.createdAt')}</dt>
                    <dd>
                      {format.dateTime(new Date(product.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone:
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('products.updatedAt')}</dt>
                    <dd>
                      {format.dateTime(new Date(product.updatedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone:
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                      })}
                    </dd>
                  </div>
                </dl>
                <div
                  className="detail-description"
                >
                  <h2>{t('form.description')}</h2>
                  <p>{product.description || t('products.noDescription')}</p>
                </div>
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
