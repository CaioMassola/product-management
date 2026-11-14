import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import { Pagination } from './pagination';
import { Field, PageHeading } from './controls';

describe('pagination', () => {
  it('navigates neighboring and distant pages and changes page size', async () => {
    const user = userEvent.setup(),
      onPageChange = vi.fn(),
      onSizeChange = vi.fn();

    render(
      <NextIntlClientProvider
        locale="en"
        messages={messages}
      >
        <Pagination
          page={4}
          size={10}
          totalElements={100}
          totalPages={10}
          busy={false}
          onPageChange={onPageChange}
          onSizeChange={onSizeChange}
        />
        <Field
          id="optional"
          label="Optional"
          hint="Hint"
        >
          <input
            id="optional"
          />
        </Field>
        <PageHeading
          title="Heading"
          description="Description"
        />
      </NextIntlClientProvider>,
    );
    await user.click(
      screen.getByRole('button', { name: messages.common.previous }),
    );
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await user.click(
      screen.getByRole('button', { name: messages.common.next }),
    );
    expect(onPageChange).toHaveBeenLastCalledWith(5);
    await user.click(screen.getByRole('button', { name: 'Page 10' }));
    expect(onPageChange).toHaveBeenLastCalledWith(9);
    await user.selectOptions(screen.getByRole('combobox'), '100');
    expect(onSizeChange).toHaveBeenCalledWith(100);
    expect(document.querySelectorAll('.pagination-ellipsis')).toHaveLength(2);
    expect(screen.getByText('Hint')).toBeInTheDocument();
  });
  it('disables empty and busy pagination', () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={messages}
      >
        <Pagination
          page={0}
          size={25}
          totalElements={0}
          totalPages={0}
          busy
          onPageChange={vi.fn()}
          onSizeChange={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: messages.common.next }),
    ).toBeDisabled();
  });
});
