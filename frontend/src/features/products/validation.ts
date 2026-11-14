import { z } from 'zod';
import { PRODUCT_TYPES } from './types';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export function validMoney(value: string) {
  return /^\d{1,12}(?:\.\d{1,2})?$/.test(value);
}

export function normalizeMoney(value: string) {
  return value.trim().replace(',', '.');
}

export function validPriceRange(min: string, max: string) {
  return (
    (!min || validMoney(min)) &&
    (!max || validMoney(max)) &&
    (!min || !max || Number(min) <= Number(max))
  );
}

export function productSchema(
  t: (
    key:
      | 'required'
      | 'codeLength'
      | 'titleLength'
      | 'descriptionLength'
      | 'price'
      | 'quantity'
      | 'type',
  ) => string,
) {
  return z.object({
    code: z.string().trim().min(1, t('required')).max(64, t('codeLength')),
    title: z.string().trim().min(1, t('required')).max(200, t('titleLength')),
    description: z.string().max(4000, t('descriptionLength')),
    price: z
      .string()
      .refine((value) => validMoney(normalizeMoney(value)), t('price')),
    quantity: z
      .string()
      .refine(
        (value) => /^\d+$/.test(value) && Number(value) <= 2147483647,
        t('quantity'),
      ),
    productType: z
      .string()
      .refine(
        (value) =>
          PRODUCT_TYPES.includes(value as (typeof PRODUCT_TYPES)[number]),
        t('type'),
      ),
  });
}

export type ProductFormValues = z.infer<ReturnType<typeof productSchema>>;
