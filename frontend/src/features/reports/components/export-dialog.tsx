'use client';

import { MoneyInput } from '@/components/ui/money-input';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { useFormatter, useTranslations } from 'next-intl';
import { Download, Info, Plus, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Field, Select } from '@/components/ui/controls';
import {
  PRODUCT_TYPES,
  type ProductStatus,
  type ProductType,
} from '@/features/products/types';
import { validPriceRange } from '@/features/products/validation';
import { errorKey } from '@/lib/api-client';
import { requestReport } from '../api';
import { useTrackReport } from '../report-tracking';
import type { ReportFilters } from '../types';

function ExportForm({
  close,
  onPendingChange,
}: {
  close: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const track = useTrackReport();
  const [type, setType] = useState<ProductType | ''>('');
  const [status, setStatus] = useState<ProductStatus | 'ALL'>('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const valid = validPriceRange(minPrice, maxPrice);

  const mutation = useMutation({
    mutationFn: requestReport,
    onSettled: () => onPendingChange(false),
    onSuccess: (report) => {
      track(report);
      toast.success(t('reports.requested'));
      close();
    },
  });

  const reset = () => {
    setType('');
    setStatus('ALL');
    setMinPrice('');
    setMaxPrice('');
    mutation.reset();
  };

  return (
    <>
      <Dialog.Title
        className="export-title"
      >
        <Download
          size={23}
        />
        {t('reports.requestTitle')}
      </Dialog.Title>
      <Dialog.Description
        className="export-description"
      >
        {t('reports.requestDescription')}
      </Dialog.Description>
      <Dialog.Close
        className="icon-button dialog-close"
        aria-label={t('common.close')}
        disabled={mutation.isPending}
      >
        <X
          size={19}
        />
      </Dialog.Close>
      <div
        className="export-information"
      >
        <Info
          size={17}
        />
        <p>{t('reports.allProductsHelp')}</p>
      </div>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;

          const filters: ReportFilters = {
            ...(type && { productType: type }),
            ...(status !== 'ALL' && { productStatus: status }),
            ...(minPrice !== '' && { minPrice: Number(minPrice) }),
            ...(maxPrice !== '' && { maxPrice: Number(maxPrice) }),
          };

          onPendingChange(true);
          mutation.mutate(filters);
        }}
      >
        <fieldset
          disabled={mutation.isPending}
          className="export-filter-grid"
        >
          <Field
            label={t('reports.productType')}
            id="export-type"
          >
            <Select
              id="export-type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as ProductType | '')
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
            id="export-status"
          >
            <Select
              id="export-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ProductStatus | 'ALL')
              }
            >
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((status) => (
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
            id="export-min"
          >
            <MoneyInput
              id="export-min"
              placeholder={format.number(100, {
                useGrouping: false,
                minimumFractionDigits: 2,
              })}
              value={minPrice}
              aria-invalid={!valid}
              aria-describedby={!valid ? 'export-range-error' : undefined}
              onValueChange={setMinPrice}
            />
          </Field>
          <Field
            label={t('products.maxPrice')}
            id="export-max"
          >
            <MoneyInput
              id="export-max"
              placeholder={format.number(500, {
                useGrouping: false,
                minimumFractionDigits: 2,
              })}
              value={maxPrice}
              aria-invalid={!valid}
              aria-describedby={!valid ? 'export-range-error' : undefined}
              onValueChange={setMaxPrice}
            />
          </Field>
        </fieldset>
        {!valid && (
          <p
            id="export-range-error"
            className="field-error"
            role="alert"
          >
            {t('products.invalidRange')}
          </p>
        )}
        <p
          className="export-combined-help"
        >{t('reports.combinedHelp')}</p>
        <div
          className="export-example"
        >{t('reports.example')}</div>
        {mutation.isError && (
          <p
            className="notice notice-error"
            role="alert"
          >
            {t(`errors.${errorKey(mutation.error)}`)}
          </p>
        )}
        <div
          className="export-actions"
        >
          <Button
            type="button"
            variant="ghost"
            onClick={reset}
            disabled={mutation.isPending}
          >
            <RotateCcw
              size={15}
            />
            {t('common.clear')}
          </Button>
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={mutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              busy={mutation.isPending}
              disabled={!valid}
            >
              <Download
                size={16}
              />
              {t('reports.request')}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

export function ExportDialog({
  fromReports = false,
}: {
  fromReports?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <Dialog.Trigger
        asChild
      >
        <Button>
          {fromReports ? <Plus
            size={17}
                         /> : <Download
                           size={16}
                              />}
          {t(fromReports ? 'reportCenter.new' : 'products.export')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="dialog-overlay export-overlay"
        />
        <Dialog.Content
          className="dialog-content export-dialog"
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <ExportForm
            close={() => setOpen(false)}
            onPendingChange={setPending}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
