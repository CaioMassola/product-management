import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import messages from '@/messages/en.json';
import portugueseMessages from '@/messages/pt-BR.json';
import { ProductList } from './product-list';
import { ProductEditor } from './product-editor';
import { ProductDetails } from './product-details';
import { ProductImage } from './product-image';
import { fireEvent } from '@testing-library/react';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a
      href={href}
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const product = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'GAME-1',
  title: 'Strategy Game',
  description: '',
  price: 149.9,
  quantity: 12,
  productType: 'GAMES',
  status: 'ACTIVE',
  imageKey: null,
  createdAt: '2026-11-13T12:00:00Z',
  updatedAt: '2026-11-13T12:00:00Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const page = {
  content: [product],
  page: 0,
  size: 25,
  totalElements: 1,
  totalPages: 1,
};

function mount(children: ReactNode, locale: 'en' | 'pt-BR' = 'en') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={locale === 'pt-BR' ? portugueseMessages : messages}
    >
      <QueryClientProvider
        client={client}
      >{children}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('product interface flows', () => {
  it('shows saving feedback while a mutation is pending and reports unexpected cancellation', async () => {
    let reject!: (reason: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options?: RequestInit) =>
        options?.method === 'PUT'
          ? new Promise<Response>((_resolve, fail) => {
              reject = fail;
            })
          : Promise.resolve(json(product)),
      ),
    );
    mount(<ProductEditor
      id={product.id}
          />);
    await screen.findByLabelText('Code *');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save product' }));
    expect(
      await screen.findByRole('button', { name: messages.common.saving }),
    ).toBeDisabled();
    const error = new Error('cancelled');
    error.name = 'AbortError';
    reject(error);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.errors.unexpected,
    );
  });
  it.each(['ACTIVE', 'INACTIVE'])(
    'shows a failed %s status change without changing the record',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation((_url: string, options?: RequestInit) =>
            Promise.resolve(
              options?.method === 'PATCH'
                ? json({}, 503)
                : json({ ...product, status }),
            ),
          ),
      );
      mount(<ProductDetails
        id={product.id}
            />);
      await screen.findByRole('heading', { name: product.title });
      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', {
          name: status === 'ACTIVE' ? 'Deactivate' : 'Reactivate',
        }),
      );
      if (status === 'ACTIVE') {
        await user.click(
          within(screen.getByRole('dialog')).getByRole('button', {
            name: 'Deactivate',
          }),
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
          messages.errors.unavailable,
        );
      } else
        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: 'Reactivate' }),
          ).not.toHaveAttribute('aria-busy', 'true'),
        );
    },
  );
  it('returns to page one when a product page has become empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            json(
              new URL(url).searchParams.get('page') === '1'
                ? { ...page, content: [], page: 1, totalPages: 2 }
                : { ...page, totalPages: 2 },
            ),
          ),
        ),
    );
    mount(<ProductList />);
    const user = userEvent.setup();
    await screen.findByText(product.title);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(await screen.findByRole('button', { name: 'First page' }));
    expect(await screen.findByText(product.title)).toBeInTheDocument();
  });
  it('opens the new-image picker and saves a new product with an image', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:image');
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(json({ ...product, imageKey: 'image.png' })),
        ),
    );
    mount(<ProductEditor />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Code *'), 'NEW');
    await user.type(screen.getByLabelText('Title *'), 'New product');
    await user.type(screen.getByLabelText('Price (BRL) *'), '12.50');
    await user.type(screen.getByLabelText('Description'), 'Description');
    await user.selectOptions(screen.getByLabelText('Type *'), 'GAMES');
    await user.click(
      screen.getByText(messages.form.imagePrompt).closest('button')!,
    );
    await user.upload(
      screen.getByLabelText(/Product image/),
      new File(['sample'], 'new.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/products/${product.id}`),
    );
  });
  it('renders loading, missing and retried product details', async () => {
    let resolve!: (value: Response) => void;

    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockImplementation(() => Promise.resolve(json(product)));

    vi.stubGlobal('fetch', fetcher);
    mount(<ProductDetails
      id={product.id}
          />);
    expect(screen.getByRole('status')).toHaveTextContent(
      messages.common.loading,
    );
    resolve(json({}, 404));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.errors.notFound,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: product.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.products.noDescription),
    ).toBeInTheDocument();
  });
  it('shows image, description and an immediate activation action in details', async () => {
    const inactive = {
      ...product,
      imageKey: 'products/image.png',
      description: 'Detailed description',
      status: 'INACTIVE',
    };

    const fetcher = vi
      .fn()
      .mockImplementation((url: string, options?: RequestInit) =>
        Promise.resolve(
          json(
            options?.method === 'PATCH'
              ? { ...inactive, status: 'ACTIVE' }
              : inactive,
          ),
        ),
      );

    vi.stubGlobal('fetch', fetcher);
    mount(<ProductDetails
      id={product.id}
          />);
    expect(await screen.findByText('Detailed description')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      expect.stringContaining('/image?v='),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: messages.products.activate }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some((call) => call[1]?.method === 'PATCH'),
      ).toBe(true),
    );
  });
  it('falls back to an accessible placeholder when a product image cannot load', () => {
    mount(
      <ProductImage
        src="/missing.png"
        alt="Product image"
        className="custom-image"
      />,
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveClass('image-fallback');
  });
  it('loads an editor, reports a lookup failure and retries', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(() =>
        Promise.resolve(json({ ...product, description: null })),
      );

    vi.stubGlobal('fetch', fetcher);
    mount(<ProductEditor
      id={product.id}
          />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Code *')).toHaveValue(product.code);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cancel' }));
    expect(push).toHaveBeenCalledWith('/products');
  });
  it('maps server field conflicts without assigning unknown fields to the form', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve(
          options?.method === 'PUT'
            ? json({ errors: { code: 'Duplicate', unknown: 'Unknown' } }, 409)
            : json(product),
        ),
      );

    vi.stubGlobal('fetch', fetcher);
    mount(<ProductEditor
      id={product.id}
          />);
    await screen.findByLabelText('Code *');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save product' }));
    expect(
      await screen.findByText(messages.validation.server),
    ).toBeInTheDocument();
  });
  it('protects dirty data on unload and validates empty, oversized and nonimage uploads', async () => {
    vi.stubGlobal('fetch', vi.fn());
    mount(<ProductEditor />);
    const user = userEvent.setup({ applyAccept: false });
    await user.type(screen.getByLabelText('Code *'), 'DIRTY');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const input = screen.getByLabelText(/Product image/);
    for (const file of [
      new File(['text'], 'bad.txt', { type: 'text/plain' }),
      new File([], 'empty.png', { type: 'image/png' }),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
        type: 'image/png',
      }),
    ]) {
      await user.upload(input, file);
      expect(screen.getByText(messages.form.imageInvalid)).toBeInTheDocument();
    }

    fireEvent.change(input, { target: { files: [] } });
  });
  it('replaces previews, removes the persisted image and saves without deleting the product', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    const imageProduct = { ...product, imageKey: 'image.png' };

    const fetcher = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve(
          json(options?.method === 'DELETE' ? product : imageProduct),
        ),
      );

    vi.stubGlobal('fetch', fetcher);

    const view = mount(<ProductEditor
      id={product.id}
                       />);

    await screen.findByLabelText('Code *');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Replace image' }));
    const input = screen.getByLabelText(/Product image/);
    await user.upload(
      input,
      new File(['one'], 'one.png', { type: 'image/png' }),
    );
    await user.upload(
      input,
      new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    await user.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(screen.getByText(messages.form.imageRemove)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          (call) => call[1]?.method === 'DELETE' && call[0].endsWith('/image'),
        ),
      ).toBe(true),
    );
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
  it('sorts, paginates, changes page size and clears filters', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      const query = new URL(url).searchParams;

      return Promise.resolve(
        json({
          ...page,
          page: Number(query.get('page')),
          totalElements: 500,
          totalPages: 20,
        }),
      );
    });

    vi.stubGlobal('fetch', fetcher);
    mount(<ProductList />);
    await screen.findByText(product.title);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sort by Code' }));
    await user.click(screen.getByRole('button', { name: 'Sort by Code' }));
    await waitFor(() =>
      expect(String(fetcher.mock.lastCall?.[0])).toContain('direction=DESC'),
    );
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(String(fetcher.mock.lastCall?.[0])).toContain('page=1'),
    );
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await user.click(screen.getByRole('button', { name: 'Page 20' }));
    await user.selectOptions(screen.getByLabelText('Items per page'), '100');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Items per page')).toHaveValue('25'),
    );
  });
  it('blocks inverted price ranges and recovers from an empty catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            json({ ...page, content: [], totalElements: 0, totalPages: 0 }),
          ),
        ),
    );
    mount(<ProductList />);
    const user = userEvent.setup();
    await screen.findByText(messages.products.empty);
    await user.type(screen.getByLabelText('Minimum price (BRL)'), '500');
    await user.type(screen.getByLabelText('Maximum price (BRL)'), '100');
    expect(screen.getByRole('alert')).toHaveTextContent(
      messages.products.invalidRange,
    );
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Minimum price (BRL)')).toHaveValue('');
  });
  beforeEach(() => {
    push.mockReset();
  });

  it('requests active products and sends combined filters to the API', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(json(page)));

    vi.stubGlobal('fetch', fetchMock);
    mount(<ProductList />);
    await screen.findByText('Strategy Game');
    expect(fetchMock.mock.calls[0][0]).toContain('status=ACTIVE');
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Type'), 'GAMES');
    await user.selectOptions(screen.getByLabelText('Status'), 'ALL');
    await user.type(screen.getByLabelText('Minimum price (BRL)'), '100');
    await user.type(screen.getByLabelText('Maximum price (BRL)'), '500');
    await user.type(
      screen.getByRole('textbox', { name: 'Search products' }),
      'strategy',
    );
    await waitFor(() => {
      const url = String(fetchMock.mock.lastCall?.[0]);
      expect(url).toContain('search=strategy');
      expect(url).toContain('productType=GAMES');
      expect(url).toContain('status=ALL');
      expect(url).toContain('minPrice=100');
      expect(url).toContain('maxPrice=500');
    });
  });

  it('requires confirmation before sending an inactivation request', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve(
          json(
            options?.method === 'PATCH'
              ? { ...product, status: 'INACTIVE' }
              : page,
          ),
        ),
      );

    vi.stubGlobal('fetch', fetchMock);
    mount(<ProductList />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    expect(
      fetchMock.mock.calls.some((call) => call[1]?.method === 'PATCH'),
    ).toBe(false);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Its record and code will be preserved');
    await user.click(dialog.querySelector('button.button-danger')!);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) => call[1]?.body === '{"status":"INACTIVE"}',
        ),
      ).toBe(true),
    );
  });

  it('shows API connection failures with a retry action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Network error')),
    );
    mount(<ProductList />);
    expect(
      await screen.findByText(messages.errors.offline),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
  });

  it('blocks an empty form before making any API mutation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mount(<ProductEditor />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(
      2,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confirms unsaved changes when going back and preserves the draft when cancelled', async () => {
    mount(<ProductEditor />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Code *'), 'DRAFT-1');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Code *')).toHaveValue('DRAFT-1');
    expect(push).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Discard',
      }),
    );
    expect(push).toHaveBeenCalledWith('/products');
  });

  it('edits Portuguese monetary values with a comma and submits a numeric API price', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(json(product)));

    vi.stubGlobal('fetch', fetchMock);
    mount(<ProductEditor
      id={product.id}
          />, 'pt-BR');
    expect(await screen.findByLabelText('Preço (R$) *')).toHaveValue('149,90');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Salvar produto' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (call) => call[1]?.method === 'PUT',
      );

      expect(JSON.parse(call?.[1]?.body).price).toBe(149.9);
    });
  });

  it('retains the created ID when an image upload fails so retry updates instead of duplicating', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:test-image');
    URL.revokeObjectURL = vi.fn();

    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(url.endsWith('/image') ? json({}, 503) : json(product)),
      );

    vi.stubGlobal('fetch', fetchMock);
    mount(<ProductEditor />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Code *'), 'GAME-1');
    await user.type(screen.getByLabelText('Title *'), 'Strategy Game');
    await user.type(screen.getByLabelText('Price (BRL) *'), '149.90');
    await user.selectOptions(screen.getByLabelText('Type *'), 'GAMES');
    await user.upload(
      screen.getByLabelText(/Product image/),
      new File(['sample'], 'image.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(
      await screen.findByText(messages.form.imagePartial),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((call) => call[1]?.method === 'PUT'),
      ).toHaveLength(1),
    );
    expect(
      fetchMock.mock.calls.filter(
        (call) => call[1]?.method === 'POST' && !call[0].endsWith('/image'),
      ),
    ).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });
});
