import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { ReportCenter } from './report-center';

const completed = {
  id: '11111111-1111-1111-1111-111111111111',
  filename: 'PRODUCT_REPORT_20261113_210000.xlsx',
  status: 'COMPLETED',
  requestedAt: '2026-11-13T21:00:00Z',
  startedAt: '2026-11-13T21:00:01Z',
  completedAt: '2026-11-13T21:00:02Z',
  filters: {
    productType: 'GAMES',
    productStatus: 'ACTIVE',
    minPrice: 0,
    maxPrice: 500,
  },
  downloadAvailable: true,
  errorMessage: null,
};

const page = {
  content: [completed],
  page: 0,
  size: 25,
  totalElements: 1,
  totalPages: 1,
  activeCount: 0,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const view = render(
    <NextIntlClientProvider
      locale="en"
      timeZone="UTC"
      messages={messages}
    >
      <QueryClientProvider
        client={client}
      >
        <ReportCenter />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );

  return { ...view, client };
}

describe('report center', () => {
  it('restores focus to the main region if a report trigger disappears', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(json(url.includes('/reports?') ? page : completed)),
        ),
    );
    mount();
    const main = document.createElement('main');
    main.id = 'main-content';
    main.tabIndex = -1;
    document.body.append(main);
    const user = userEvent.setup();

    const trigger = await screen.findByRole('button', {
      name: `View details of ${completed.filename}`,
    });

    await user.click(trigger);
    trigger.remove();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(main).toHaveFocus());
    main.remove();
  });
  it('sorts in both directions, navigates pages and resets the page when changing size', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        json({
          ...page,
          page: Number(new URL(url).searchParams.get('page')),
          totalElements: 200,
          totalPages: 8,
        }),
      ),
    );

    vi.stubGlobal('fetch', fetcher);
    mount();
    const user = userEvent.setup();
    await screen.findByText(completed.filename);
    await user.click(screen.getByRole('button', { name: 'Sort by Report' }));
    await user.click(screen.getByRole('button', { name: 'Sort by Report' }));
    await waitFor(() =>
      expect(String(fetcher.mock.lastCall?.[0])).toContain('direction=DESC'),
    );
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(String(fetcher.mock.lastCall?.[0])).toContain('page=1'),
    );
    await user.selectOptions(screen.getByLabelText('Items per page'), '50');
    await waitFor(() =>
      expect(String(fetcher.mock.lastCall?.[0])).toContain('size=50'),
    );
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Items per page')).toHaveValue('25');
  });
  it('blocks invalid dates and monetary ranges then clears all filters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(page))),
    );
    mount();
    const user = userEvent.setup();
    await screen.findByText(completed.filename);
    await user.type(screen.getByLabelText('Minimum price used (BRL)'), '500');
    await user.type(screen.getByLabelText('Maximum price used (BRL)'), '100');
    expect(
      screen.getByText(messages.products.invalidRange),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Requested from'), {
      target: { value: '2026-11-14' },
    });
    fireEvent.change(screen.getByLabelText('Requested through'), {
      target: { value: '2026-11-13' },
    });
    expect(
      screen.getByText(messages.reportCenter.invalidDates),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(
      screen.queryByText(messages.reportCenter.invalidDates),
    ).not.toBeInTheDocument();
  });
  it('retries history errors and returns to the first page when the requested page becomes empty', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation((url: string) => {
        const current = Number(new URL(url).searchParams.get('page'));

        return Promise.resolve(
          json(
            current
              ? { ...page, content: [], page: current, totalPages: 2 }
              : { ...page, totalPages: 2 },
          ),
        );
      });

    vi.stubGlobal('fetch', fetcher);
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await screen.findByText(completed.filename);
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(await screen.findByRole('button', { name: 'First page' }));
    await screen.findByText(completed.filename);
  });
  it('clears filters from an empty first page', async () => {
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
    mount();
    await screen.findByText(messages.reportCenter.empty);
    const buttons = screen.getAllByRole('button', { name: 'Clear filters' });
    await userEvent.setup().click(buttons[buttons.length - 1]);
    expect(screen.getByLabelText('Report name')).toHaveValue('');
  });
  beforeEach(() => {
    window.localStorage.clear();
  });
  it('shows saved criteria, zero-valued bounds and completed downloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(page)));
    mount();
    expect(await screen.findByText(completed.filename)).toBeInTheDocument();
    expect(screen.getByText(/Games · Active · Min\./)).toHaveTextContent(
      '0.00',
    );
    expect(screen.getByRole('link', { name: 'XLSX' })).toHaveAttribute(
      'href',
      expect.stringContaining(`/${completed.id}/download`),
    );
    expect(
      screen.getByRole('button', { name: 'New report' }),
    ).toBeInTheDocument();
  });
  it('combines processing, product criteria and whole-day request dates in backend queries', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(json(page)));

    vi.stubGlobal('fetch', fetchMock);
    mount();
    await screen.findByText(completed.filename);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Processing'), 'COMPLETED');
    await user.selectOptions(screen.getByLabelText('Product type'), 'GAMES');
    await user.selectOptions(
      screen.getByLabelText('Product status'),
      'INACTIVE',
    );
    await user.type(screen.getByLabelText('Minimum price used (BRL)'), '100');
    await user.type(screen.getByLabelText('Maximum price used (BRL)'), '500');
    await user.type(screen.getByLabelText('Requested from'), '2026-11-13');
    await user.type(screen.getByLabelText('Requested through'), '2026-11-13');
    await user.type(
      screen.getByRole('textbox', { name: 'Report name' }),
      'product_report',
    );
    await waitFor(() => {
      const url = new URL(String(fetchMock.mock.lastCall?.[0]));
      expect(url.searchParams.get('name')).toBe('product_report');
      expect(url.searchParams.get('status')).toBe('COMPLETED');
      expect(url.searchParams.get('productType')).toBe('GAMES');
      expect(url.searchParams.get('productStatus')).toBe('INACTIVE');
      expect(url.searchParams.get('minPrice')).toBe('100');
      expect(url.searchParams.get('maxPrice')).toBe('500');
      expect(url.searchParams.get('requestedFrom')).toBe(
        new Date(2026, 10, 13).toISOString(),
      );
      expect(url.searchParams.get('requestedTo')).toBe(
        new Date(2026, 10, 14).toISOString(),
      );
    });
  });
  it('hides downloads for pending and failed reports and shows safe failure feedback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          ...page,
          content: [
            { ...completed, status: 'PENDING', downloadAvailable: false },
            {
              ...completed,
              id: '22222222-2222-2222-2222-222222222222',
              filename: 'FAILED.xlsx',
              status: 'FAILED',
              downloadAvailable: false,
            },
          ],
          activeCount: 1,
        }),
      ),
    );
    mount();
    await screen.findByText('FAILED.xlsx');
    expect(
      screen.queryByRole('link', { name: 'XLSX' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(messages.reports.failedHelp)).toBeInTheDocument();
  });
  it('opens report details with its processing timestamps', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(json(url.includes('/reports?') ? page : completed)),
        ),
    );
    mount();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: `View details of ${completed.filename}`,
      }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Processing started')).toBeInTheDocument();
    expect(within(dialog).getByText('Finished on')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', { name: 'Download XLSX' }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: `View details of ${completed.filename}`,
        }),
      ).toHaveFocus(),
    );
  });
  it('polls when active jobs are hidden by filters and stops when the global active count reaches zero', async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ...page, content: [], activeCount: 1 }))
      .mockImplementation(() =>
        Promise.resolve(json({ ...page, content: [], activeCount: 0 })),
      );

    vi.stubGlobal('fetch', fetchMock);
    const view = mount();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      view.unmount();
      view.client.clear();
      vi.useRealTimers();
    }
  });
});
