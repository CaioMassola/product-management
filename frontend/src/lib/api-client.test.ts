import { describe, expect, it, vi } from 'vitest';
import { apiRequest, ApiError, errorKey, API_URL } from './api-client';
import {
  changeProductStatus,
  createProduct,
  getProduct,
  listProducts,
  productImageUrl,
  removeProductImage,
  updateProduct,
  uploadProductImage,
} from '@/features/products/api';
import {
  getReport,
  listReports,
  reportDownloadUrl,
  requestReport,
} from '@/features/reports/api';

describe('HTTP boundary', () => {
  it('preserves custom headers, signals and JSON bodies', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"id":"saved"}'));
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    expect(
      await apiRequest('/test', {
        method: 'POST',
        body: '{}',
        headers: { 'X-Test': 'yes' },
        signal,
      }),
    ).toEqual({ id: 'saved' });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(`${API_URL}/test`);
    expect(options.signal).toBe(signal);
    expect(options.headers.get('Content-Type')).toBe('application/json');
    expect(options.headers.get('X-Test')).toBe('yes');
  });
  it('handles empty success, malformed error bodies and field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response('bad', { status: 500 }))
        .mockResolvedValueOnce(
          new Response('{"errors":{"price":"Invalid"}}', { status: 400 }),
        )
        .mockResolvedValueOnce(new Response('{}', { status: 404 })),
    );
    expect(await apiRequest('/empty')).toBeUndefined();
    await expect(apiRequest('/broken')).rejects.toMatchObject({
      status: 500,
      fields: {},
    });
    await expect(apiRequest('/invalid')).rejects.toMatchObject({
      status: 400,
      fields: { price: 'Invalid' },
    });
    await expect(apiRequest('/missing')).rejects.toMatchObject({
      status: 404,
      fields: {},
    });
  });
  it('preserves cancellation and maps network failures', async () => {
    const abort = new DOMException('Cancelled', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(abort)
        .mockRejectedValueOnce(new TypeError('offline'))
        .mockRejectedValueOnce('offline'),
    );
    await expect(apiRequest('/cancel')).rejects.toBe(abort);
    await expect(apiRequest('/offline')).rejects.toMatchObject({ status: 0 });
    await expect(apiRequest('/offline')).rejects.toMatchObject({ status: 0 });
  });
  it.each([
    [0, 'offline'],
    [404, 'notFound'],
    [409, 'conflict'],
    [400, 'invalid'],
    [413, 'invalid'],
    [415, 'invalid'],
    [503, 'unavailable'],
    [500, 'unexpected'],
  ])('maps HTTP %s to localized feedback', (status, key) => {
    expect(errorKey(new ApiError(Number(status)))).toBe(key);
  });
  it('handles unexpected exceptions', () => {
    expect(errorKey(new Error('unknown'))).toBe('unexpected');
  });
  it('sends product and report contracts with numeric prices and private image URLs', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('{}')));

    vi.stubGlobal('fetch', fetcher);

    const input = {
      code: 'ABC',
      title: 'Product',
      description: null,
      price: 123.45,
      quantity: 2,
      productType: 'GAMES' as const,
    };

    await createProduct(input);
    await updateProduct('p', input);
    await changeProductStatus('p', 'INACTIVE');
    await getProduct('p');
    await uploadProductImage(
      'p',
      new File(['image'], 'test.png', { type: 'image/png' }),
    );
    await removeProductImage('p');
    await listProducts({
      search: 'a b',
      productType: '',
      status: 'ALL',
      minPrice: '',
      maxPrice: '',
      page: 0,
      size: 25,
      sortBy: 'price',
      direction: 'ASC',
    });
    await requestReport({ minPrice: 0 });
    await getReport('r');
    await listReports({
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
    });
    expect(fetcher.mock.calls[0][1].body).toBe(JSON.stringify(input));
    expect(fetcher.mock.calls[4][1].body).toBeInstanceOf(FormData);
    expect(fetcher.mock.calls[4][1].headers.has('Content-Type')).toBe(false);
    expect(fetcher.mock.calls[5][1].method).toBe('DELETE');
    expect(fetcher.mock.calls[6][0]).toContain('search=a+b&status=ALL');
    expect(reportDownloadUrl('r')).toBe(`${API_URL}/reports/r/download`);
    expect(
      productImageUrl({
        id: 'p',
        updatedAt: '2026-01-01T00:00:00Z',
      } as Parameters<typeof productImageUrl>[0]),
    ).toContain('v=2026-01-01T00%3A00%3A00Z');
  });
});
