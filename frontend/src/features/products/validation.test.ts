import { describe, expect, it } from 'vitest';
import { productSchema, validPriceRange } from './validation';

describe('product validation', () => {
  const schema = productSchema((key) => key);

  const valid = {
    code: 'P-1',
    title: 'Product',
    description: '',
    price: '149,90',
    quantity: '0',
    productType: 'GAMES',
  };

  it('accepts a zero stock and a localized nonnegative price', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });
  it.each([
    { price: '-1' },
    { price: '1.001' },
    { quantity: '-1' },
    { quantity: '1.5' },
    { quantity: '2147483648' },
    { productType: 'CUSTOM' },
    { code: '  ' },
    { title: '' },
  ])('rejects invalid product input %j', (change) => {
    expect(schema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it('validates combined inclusive price boundaries', () => {
    expect(validPriceRange('', '')).toBe(true);
    expect(validPriceRange('100', '100')).toBe(true);
    expect(validPriceRange('500', '100')).toBe(false);
    expect(validPriceRange('0.001', '')).toBe(false);
  });
});
