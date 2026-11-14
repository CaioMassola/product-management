import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvalidateProducts } from './queries';

describe('product cache invalidation', () => {
  it('invalidates the catalog without targeting an individual product when no ID is supplied', async () => {
    const client = new QueryClient();
    const invalidation = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useInvalidateProducts(), {
      wrapper: ({ children }) => (
        <QueryClientProvider
          client={client}
        >{children}</QueryClientProvider>
      ),
    });

    await act(() => result.current());
    expect(invalidation).toHaveBeenCalledExactlyOnceWith({
      queryKey: ['products'],
    });
    client.clear();
  });
});
