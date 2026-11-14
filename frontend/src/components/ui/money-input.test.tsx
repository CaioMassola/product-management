import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { MoneyInput } from './money-input';

function mount(locale = 'pt-BR', initial = '') {
  function Example() {
    const [value, setValue] = useState(initial);

    return (
      <>
        <MoneyInput
          aria-label="Price"
          value={value}
          onValueChange={setValue}
        />
        <output
          data-testid="raw"
        >{value}</output>
        <button>Next</button>
      </>
    );
  }

  render(
    <NextIntlClientProvider
      locale={locale}
      messages={{}}
    >
      <Example />
    </NextIntlClientProvider>,
  );

  return screen.getByRole('textbox', { name: 'Price' });
}

describe('monetary input', () => {
  it('accepts a pasted amount when the input selection is unavailable', async () => {
    const input = mount('en');
    await userEvent.setup().click(input);
    vi.spyOn(
      input as HTMLInputElement,
      'selectionStart',
      'get',
    ).mockReturnValue(null);
    vi.spyOn(input as HTMLInputElement, 'selectionEnd', 'get').mockReturnValue(
      null,
    );
    fireEvent.paste(input, { clipboardData: { getData: () => '12.50' } });
    expect(input).toHaveValue('12.50');
  });
  it('accepts fractional typing and normalizes a trailing decimal separator on blur', async () => {
    const user = userEvent.setup();
    const input = mount();
    await user.type(input, ',5');
    expect(input).toHaveValue('0,5');
    await user.clear(input);
    await user.type(input, '12,');
    await user.tab();
    expect(input).toHaveValue('12,00');
  });
  it('pastes a decimal amount into the selected range and rejects an overflowing insertion', async () => {
    const user = userEvent.setup();
    const input = mount('en');
    await user.click(input);
    await user.paste('123.45');
    expect(input).toHaveValue('123.45');
    await user.paste('999999999999');
    expect(input).toHaveValue('123.45');
  });
  it('rejects letters, negatives and excess decimals, then formats Brazilian currency', async () => {
    const user = userEvent.setup();
    const input = mount();
    await user.type(input, 'abc-9000000,125');
    expect(input).toHaveValue('9000000,12');
    expect(screen.getByTestId('raw')).toHaveTextContent('9000000.12');
    await user.tab();
    expect(input).toHaveValue('9.000.000,12');
  });
  it('accepts a localized grouped paste, rejects text paste and preserves empty optional fields', async () => {
    const user = userEvent.setup();
    const input = mount();
    await user.click(input);
    await user.paste('1.234,56');
    await user.tab();
    expect(input).toHaveValue('1.234,56');
    await user.clear(input);
    await user.paste('invalid');
    await user.tab();
    expect(input).toHaveValue('');
    expect(screen.getByTestId('raw')).toBeEmptyDOMElement();
  });
  it.each([
    ['en', '1,234.50', '1234.50'],
    ['es', '1234,50', '1234,50'],
  ])(
    'formats existing prices for %s without changing their amount',
    async (locale, display, editing) => {
      const user = userEvent.setup();
      const input = mount(locale, '1234.50');
      expect(input).toHaveValue(display);
      await user.click(input);
      expect(input).toHaveValue(editing);
      await user.tab();
      expect(input).toHaveValue(display);
      expect(screen.getByTestId('raw')).toHaveTextContent('1234.50');
    },
  );
});
