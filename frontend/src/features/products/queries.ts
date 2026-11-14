import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProduct, listProducts } from './api';
import type { ProductFilters } from './types';

export function useProducts(filters: ProductFilters, enabled = true) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: ({ signal }) => listProducts(filters, signal),
    enabled,
  });
}

export function useProduct(id?: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: ({ signal }) => getProduct(id!, signal),
    enabled: Boolean(id),
  });
}

export function useInvalidateProducts() {
  const client = useQueryClient();

  return async (id?: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['products'] }),
      ...(id ? [client.invalidateQueries({ queryKey: ['product', id] })] : []),
    ]);
  };
}
