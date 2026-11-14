'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Power, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { changeProductStatus } from '../api';
import { useInvalidateProducts } from '../queries';
import type { Product } from '../types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/controls';
import { errorKey } from '@/lib/api-client';

export function StatusAction({
  product,
  disabled,
  compact = false,
}: {
  product: Product;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const t = useTranslations();
  const invalidate = useInvalidateProducts();

  const mutation = useMutation({
    mutationFn: () =>
      changeProductStatus(
        product.id,
        product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      ),
    onSuccess: async () => {
      toast.success(
        t(
          product.status === 'ACTIVE'
            ? 'products.deactivated'
            : 'products.activated',
        ),
      );
      setConfirm(false);
      await invalidate(product.id);
    },
    onError: (error) => {
      if (!confirm) toast.error(t(`errors.${errorKey(error)}`));
    },
  });

  const label = t(
    product.status === 'ACTIVE' ? 'products.deactivate' : 'products.activate',
  );

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'secondary'}
        className={compact ? 'compact-action' : ''}
        aria-label={label}
        title={label}
        busy={mutation.isPending}
        disabled={disabled}
        onClick={() => {
          mutation.reset();
          if (product.status === 'ACTIVE') setConfirm(true);
          else mutation.mutate();
        }}
      >
        {product.status === 'ACTIVE' ? (
          <Power
            size={15}
          />
        ) : (
          <RotateCcw
            size={15}
          />
        )}
        {!compact && label}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('products.confirmTitle')}
        description={t('products.confirmDescription', { title: product.title })}
        confirmLabel={label}
        onConfirm={() => mutation.mutate()}
        busy={mutation.isPending}
        error={
          mutation.error ? t(`errors.${errorKey(mutation.error)}`) : undefined
        }
      />
    </>
  );
}
