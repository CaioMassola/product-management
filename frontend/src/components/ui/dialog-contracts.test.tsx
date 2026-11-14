import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import messages from '@/messages/en.json';
import { ConfirmDialog } from './confirm-dialog';
import { ExportDialog } from '@/features/reports/components/export-dialog';
import { ReportDetailsDialog } from '@/features/reports/components/report-details-dialog';
import type { Report } from '@/features/reports/types';
import userEvent from '@testing-library/user-event';

const primitive = vi.hoisted(() => ({
  change: undefined as ((value: boolean) => void) | undefined,
  autoFocus: undefined as ((event: Event) => void) | undefined,
}));

vi.mock('@radix-ui/react-dialog', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@radix-ui/react-dialog')>();

  return {
    ...actual,
    Root: (props: ComponentProps<typeof actual.Root>) => {
      primitive.change = props.onOpenChange;

      return <actual.Root
        {...props}
             />;
    },
    Content: (props: ComponentProps<typeof actual.Content>) => {
      primitive.autoFocus = props.onOpenAutoFocus;

      return <actual.Content
        {...props}
             />;
    },
  };
});
vi.mock('@/features/reports/queries', () => ({
  useReport: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}));

const report: Report = {
  id: '11111111-1111-1111-1111-111111111111',
  filename: 'Snapshot.xlsx',
  status: 'PENDING',
  requestedAt: '2026-01-01T12:00:00Z',
  startedAt: null,
  completedAt: null,
  filters: {},
  downloadAvailable: false,
  errorMessage: null,
};

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="UTC"
    >
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        }
      >
        {children}
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('dialog primitive boundaries', () => {
  it('rejects primitive state changes while a confirmation is busy and handles an absent initiating element', () => {
    const change = vi.fn();
    render(
      wrap(
        <ConfirmDialog
          open
          busy
          onOpenChange={change}
          title="Confirm"
          description="Description"
          confirmLabel="Confirm"
          onConfirm={vi.fn()}
        />,
      ),
    );
    act(() => primitive.change?.(false));
    expect(change).not.toHaveBeenCalled();

    const active = vi
      .spyOn(document, 'activeElement', 'get')
      .mockReturnValue(null);

    const event = new Event('open', { cancelable: true });
    act(() => primitive.autoFocus?.(event));
    expect(event.defaultPrevented).toBe(true);
    active.mockRestore();
  });
  it('retains the selected report snapshot before live data is available and ignores a duplicate open notification', () => {
    const close = vi.fn();
    render(
      wrap(
        <ReportDetailsDialog
          report={report}
          close={close}
          restoreFocus={vi.fn()}
        />,
      ),
    );
    expect(screen.getByText(report.filename)).toBeInTheDocument();
    act(() => primitive.change?.(true));
    expect(close).not.toHaveBeenCalled();
    act(() => primitive.change?.(false));
    expect(close).toHaveBeenCalledOnce();
  });
  it('rejects a primitive close request while submitting an export', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    render(wrap(<ExportDialog />));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export XLSX' }));
    await user.click(screen.getByRole('button', { name: 'Request report' }));
    act(() => primitive.change?.(false));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
