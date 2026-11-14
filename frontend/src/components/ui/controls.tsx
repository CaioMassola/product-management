import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { LoaderCircle } from 'lucide-react';

export const buttonClass = (
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary',
) => `button button-${variant}`;

export function Button({
  variant = 'primary',
  busy,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      className={`${buttonClass(variant)} ${className}`}
      aria-busy={busy || undefined}
    >
      {busy && (
        <LoaderCircle
          size={16}
          className="animate-spin"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

export function Field({
  label,
  id,
  children,
  error,
  required,
  hint,
  className = '',
}: {
  label: string;
  id: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={`field ${className}`}
    >
      <label
        htmlFor={id}
      >
        {label}
        {required && <span
          aria-hidden
                     > *</span>}
      </label>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className="field-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {hint && (
        <p
          id={`${id}-hint`}
          className="field-hint"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={`input ${className}`}
    />
  );
}

export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`input select ${className}`}
    />
  );
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="page-heading"
    >
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
