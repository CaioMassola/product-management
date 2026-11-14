import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
import { ExportDialog } from './export-dialog';
import { ReportActivity } from '../report-tracking';

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const report = {
  id: '11111111-1111-1111-1111-111111111111',
  filename: 'PRODUCT_REPORT_20261113_210000.xlsx',
  status: 'PENDING',
  requestedAt: '2026-11-13T21:00:00Z',
  startedAt: null,
  completedAt: null,
  filters: {},
  downloadAvailable: false,
  errorMessage: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function mount(activity = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <NextIntlClientProvider
      locale="en"
      timeZone="UTC"
      messages={messages}
    >
      <QueryClientProvider
        client={client}
      >
        <ExportDialog />
        {activity && <ReportActivity />}
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );

  return client;
}

describe('asynchronous export interface', () => {
  it.each([false, true])(
    'handles an outside pointer with request pending=%s',
    async (pending) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise<Response>(() => {})),
      );
      mount();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
      if (pending)
        await user.click(
          screen.getByRole('button', { name: 'Request report' }),
        );
      await new Promise((resolve) => setTimeout(resolve, 10));
      fireEvent.pointerDown(document.querySelector('.dialog-overlay')!, {
        button: 0,
        pointerType: 'mouse',
      });
      fireEvent.click(document.querySelector('.dialog-overlay')!);
      if (pending) expect(screen.getByRole('dialog')).toBeInTheDocument();
      else
        await waitFor(() =>
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
    },
  );
  it('clears all export criteria and prevents invalid programmatic submission', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
    await user.type(screen.getByLabelText('Minimum price (BRL)'), '500');
    await user.type(screen.getByLabelText('Maximum price (BRL)'), '100');
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Minimum price (BRL)')).toHaveValue('');
    expect(screen.getByLabelText('Maximum price (BRL)')).toHaveValue('');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps a pending request open on Escape until it completes', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
    await user.click(screen.getByRole('button', { name: 'Request report' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    resolve(json(report, 202));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
  beforeEach(() => {
    window.localStorage.clear();
    window.dispatchEvent(new Event('product-management:reports'));
  });

  it('starts with all statuses and sends an empty filter object for a complete catalog export', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(report, 202));
    vi.stubGlobal('fetch', fetchMock);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Product status')).toHaveValue('ALL');
    expect(within(dialog).getByLabelText('Product type')).toHaveValue('');
    await user.click(
      within(dialog).getByRole('button', { name: 'Request report' }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/reports'),
        expect.objectContaining({ method: 'POST', body: '{}' }),
      ),
    );
    expect(
      JSON.parse(window.localStorage.getItem('product-management.report-ids')!),
    ).toContain(report.id);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('submits a snapshot of combined filters and rejects an inverted monetary range', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(json(report, 202)));

    vi.stubGlobal('fetch', fetchMock);
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
    await user.selectOptions(screen.getByLabelText('Product type'), 'GAMES');
    await user.selectOptions(
      screen.getByLabelText('Product status'),
      'INACTIVE',
    );
    await user.type(screen.getByLabelText('Minimum price (BRL)'), '500');
    await user.type(screen.getByLabelText('Maximum price (BRL)'), '100');
    expect(
      screen.getByRole('button', { name: 'Request report' }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Minimum price (BRL)'));
    await user.type(screen.getByLabelText('Minimum price (BRL)'), '50,00');
    await user.click(screen.getByRole('button', { name: 'Request report' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls[0][1].body).toBe(
        '{"productType":"GAMES","productStatus":"INACTIVE","minPrice":50,"maxPrice":100}',
      ),
    );
  });

  it('keeps the dialog open with translated feedback when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 503)));
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
    await user.click(screen.getByRole('button', { name: 'Request report' }));
    expect(
      await screen.findByText(messages.errors.unavailable),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('tracks a requested report outside the dialog and exposes download only after completion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(json(report, 202))),
    );
    const client = mount(true);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
    await user.click(screen.getByRole('button', { name: 'Request report' }));
    expect(await screen.findByText(report.filename)).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Download XLSX' }),
    ).not.toBeInTheDocument();
    client.setQueryData(['report', report.id], {
      ...report,
      status: 'COMPLETED',
      downloadAvailable: true,
    });
    expect(
      await screen.findByRole('link', { name: 'Download XLSX' }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining(`/${report.id}/download`),
    );
    expect(screen.getByText('Completed')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: `Dismiss tracking for ${report.filename}`,
      }),
    );
    expect(
      screen.queryByRole('complementary', { name: 'Exports' }),
    ).not.toBeInTheDocument();
    client.clear();
  });
});
