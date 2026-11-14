import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { ReportActivity, useTrackReport } from './report-tracking';
import { ReportDetailsDialog } from './components/report-details-dialog';
import { ReportFilterSummary } from './components/report-filter-summary';
import type { Report } from './types';

const location = vi.hoisted(() => ({ path: '/en/products' }));
vi.mock('next/navigation', () => ({ usePathname: () => location.path }));

const report: Report = {
  id: '11111111-1111-1111-1111-111111111111',
  filename: 'REPORT.xlsx',
  status: 'PENDING',
  requestedAt: '2026-01-01T12:00:00Z',
  startedAt: null,
  completedAt: null,
  filters: {},
  downloadAvailable: false,
  errorMessage: null,
};

const clients: QueryClient[] = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  clients.push(client);

  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="UTC"
    >
      <QueryClientProvider
        client={client}
      >{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function Track() {
  const track = useTrackReport();

  return <button
    onClick={() => track(report)}
         >Track</button>;
}

describe('persistent report tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
    location.path = '/en/products';
  });
  afterEach(() => {
    clients.forEach((client) => client.clear());
    clients.length = 0;
  });
  it.each(['invalid', '{}', '[1,"bad",null]'])(
    'ignores malformed saved IDs: %s',
    (value) => {
      localStorage.setItem('product-management.report-ids', value);

      const view = render(
        <Wrapper>
          <ReportActivity />
        </Wrapper>,
      );

      expect(view.container).toBeEmptyDOMElement();
    },
  );
  it('handles unavailable localStorage and continues tracking within the tab', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(report))),
    );
    render(
      <Wrapper>
        <Track />
        <ReportActivity />
      </Wrapper>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Track' }));
    expect(await screen.findByText(report.filename)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: `Dismiss tracking for ${report.filename}`,
      }),
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
  it('renders server output without reading browser storage', () => {
    expect(
      renderToString(
        <Wrapper>
          <ReportActivity />
        </Wrapper>,
      ),
    ).toBe('');
  });
  it('shows pending feedback then a failed result and stops polling', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      'product-management.report-ids',
      JSON.stringify([report.id]),
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(report))
        .mockImplementation(() =>
          Promise.resolve(json({ ...report, status: 'FAILED' })),
        ),
    );

    const view = render(
      <Wrapper>
        <ReportActivity />
      </Wrapper>,
    );

    try {
      expect(screen.getByText(messages.reports.loading)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(screen.getByText('Queued')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100);
      });
      expect(screen.getByText(messages.reports.failedHelp)).toBeInTheDocument();
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });
  it('retries a failed status lookup and hides the floating tracker in the report center', async () => {
    location.path = '/en/reports';
    localStorage.setItem(
      'product-management.report-ids',
      JSON.stringify([report.id, report.id]),
    );

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(
        json({ ...report, status: 'COMPLETED', downloadAvailable: false }),
      );

    vi.stubGlobal('fetch', fetcher);
    render(
      <Wrapper>
        <ReportActivity />
      </Wrapper>,
    );
    expect(
      await screen.findByText(messages.errors.unavailable),
    ).toBeInTheDocument();
    expect(document.querySelector('.report-activity')).toHaveAttribute(
      'hidden',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again', hidden: true }));
    await waitFor(() =>
      expect(document.querySelector('.report-filename')).toHaveTextContent(
        report.filename,
      ),
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('shows incomplete failed details, retries errors and exposes no download', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({}, 503))
        .mockImplementation(() =>
          Promise.resolve(json({ ...report, status: 'FAILED' })),
        ),
    );

    const close = vi.fn(),
      restore = vi.fn();

    render(
      <Wrapper>
        <ReportDetailsDialog
          report={report}
          close={close}
          restoreFocus={restore}
        />
      </Wrapper>,
    );
    expect(
      await screen.findByText(messages.errors.unavailable),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(messages.reports.failedHelp),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(messages.reportCenter.notAvailable),
    ).toHaveLength(2);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalled();
  });
  it('summarizes absent bounds and zero-valued maximums accurately', () => {
    render(
      <Wrapper>
        <ReportFilterSummary
          filters={{}}
        />
        <ReportFilterSummary
          filters={{ maxPrice: 0 }}
        />
      </Wrapper>,
    );
    expect(
      screen.getByText(messages.reportCenter.allProducts),
    ).toBeInTheDocument();
    expect(screen.getByText(/Max\./)).toHaveTextContent('0.00');
  });
});
