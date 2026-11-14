import { API_URL, apiRequest } from '@/lib/api-client';
import type {
  PageResponse,
  Product,
  ProductFilters,
  ProductInput,
  ProductStatus,
} from './types';

export function listProducts(filters: ProductFilters, signal?: AbortSignal) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== '') query.set(key, String(value));

  return apiRequest<PageResponse<Product>>(`/products?${query}`, { signal });
}

export const getProduct = (id: string, signal?: AbortSignal) =>
  apiRequest<Product>(`/products/${id}`, { signal });
export const createProduct = (input: ProductInput) =>
  apiRequest<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateProduct = (id: string, input: ProductInput) =>
  apiRequest<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
export const changeProductStatus = (id: string, status: ProductStatus) =>
  apiRequest<Product>(`/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
export const productImageUrl = (product: Product) =>
  `${API_URL}/products/${product.id}/image?v=${encodeURIComponent(product.updatedAt)}`;
export function uploadProductImage(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);

  return apiRequest<Product>(`/products/${id}/image`, {
    method: 'POST',
    body: form,
  });
}

export const removeProductImage = (id: string) =>
  apiRequest<Product>(`/products/${id}/image`, { method: 'DELETE' });
