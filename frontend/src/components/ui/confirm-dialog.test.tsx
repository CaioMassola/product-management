import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import axe from 'axe-core';
import messages from '@/messages/en.json';
import { ConfirmDialog } from './confirm-dialog';

function Harness({
  onConfirm,
  busy = false,
  error,
}: {
  onConfirm: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <NextIntlClientProvider
      locale="en"
      timeZone="UTC"
      messages={messages}
    >
      <button
        onClick={() => setOpen(true)}
      >Open confirmation</button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Deactivate product?"
        description="The product record will be preserved."
        confirmLabel="Deactivate"
        onConfirm={onConfirm}
        busy={busy}
        error={error}
      />
    </NextIntlClientProvider>
  );
}

describe('confirmation accessibility', () => {
  it.each([false, true])(
    'handles an outside pointer with busy=%s',
    async (busy) => {
      render(
        <Harness
          onConfirm={vi.fn()}
          busy={busy}
          error="Unable to save"
        />,
      );
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Open confirmation' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Unable to save');
      await new Promise((resolve) => setTimeout(resolve, 10));
      fireEvent.pointerDown(document.querySelector('.dialog-overlay')!, {
        button: 0,
        pointerType: 'mouse',
      });
      fireEvent.click(document.querySelector('.dialog-overlay')!);
      if (busy) expect(screen.getByRole('dialog')).toBeInTheDocument();
      else
        await waitFor(() =>
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
    },
  );
  it('restores focus to the main region after the initiating element disappears', async () => {
    render(
      <>
        <main
          id="main-content"
          tabIndex={-1}
        />
        <Harness
          onConfirm={vi.fn()}
        />
      </>,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    await user.click(trigger);
    const parent = trigger.parentNode!;
    trigger.remove();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    parent.appendChild(trigger);
  });
  it('initially focuses Cancel and restores the trigger after Escape without confirming', async () => {
    const onConfirm = vi.fn();
    render(<Harness
      onConfirm={onConfirm}
           />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    await user.click(trigger);
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('prevents dismissal while saving', async () => {
    render(
      <Harness
        onConfirm={() => {}}
        busy
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    ).toBeDisabled();
  });
  it('has no structural WCAG A/AA violations in the confirmation markup', async () => {
    render(<Harness
      onConfirm={() => {}}
           />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Open confirmation' }));

    const result = await axe.run(screen.getByRole('dialog'), {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(result.violations).toEqual([]);
  });
});
