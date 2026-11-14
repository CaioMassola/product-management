'use client';

import { useState, type ComponentProps } from 'react';
import { useLocale } from 'next-intl';
import { Input } from './controls';

type MoneyInputProps = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** Keep decimal strings in state and format only the presentation, never API values. */
export function MoneyInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: MoneyInputProps) {
  const locale = useLocale();
  const [focused, setFocused] = useState(false);

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const parts = formatter.formatToParts(12345.5);
  const decimal = parts.find((part) => part.type === 'decimal')!.value;
  const group = parts.find((part) => part.type === 'group')!.value;
  const canonical = value.replace(',', '.');

  const display = !value
    ? ''
    : focused
      ? canonical.replace('.', decimal)
      : formatter.format(Number(canonical));

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        if (canonical.endsWith('.')) onValueChange(canonical.slice(0, -1));
        onBlur?.(event);
      }}
      onChange={(event) => {
        // During typing accept either decimal key. Group separators are accepted on paste only.
        const next = event.target.value.replace(',', '.');
        if (/^\d{0,12}(?:\.\d{0,2})?$/.test(next))
          onValueChange(next.startsWith('.') ? `0${next}` : next);
      }}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData('text').trim();
        const escapedGroup = group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedDecimal = decimal.replace('.', '\\.');

        const grouped = new RegExp(
          `^\\d{1,3}(?:${escapedGroup}\\d{3})+(?:${escapedDecimal}\\d{1,2})?$`,
        );

        const next = grouped.test(text)
          ? text.split(group).join('').replace(decimal, '.')
          : text.replace(',', '.');

        if (/^\d{1,12}(?:\.\d{1,2})?$/.test(next)) {
          const input = event.currentTarget;
          const current = display;

          const replacement =
            current.slice(0, input.selectionStart ?? 0) +
            next.replace('.', decimal) +
            current.slice(input.selectionEnd ?? current.length);

          const normalized = replacement.replace(decimal, '.');
          if (/^\d{1,12}(?:\.\d{0,2})?$/.test(normalized))
            onValueChange(normalized);
        }
      }}
    />
  );
}
