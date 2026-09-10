'use client';

import { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Form primitives.
 *
 * Every input is wired to its label and its error through real ids, and errors
 * are announced with role="alert" — a screen-reader user finds out the phone
 * number was rejected at the same moment a sighted user does.
 */

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FieldShell({
  label, htmlFor, error, hint, required, children, className,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-100">
        {label}
        {required && (
          <span className="ms-1 text-burgundy-400" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-ink-400">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-[#FF8A9B]"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const inputBase =
  'w-full rounded-xl border bg-white/[0.04] px-4 text-[0.9375rem] text-ink-50 ' +
  'placeholder:text-ink-500 transition-colors duration-200 ' +
  'focus:border-burgundy-400 focus:bg-white/[0.06] focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Renders the value left-to-right — for phone numbers and codes. */
  ltr?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, ltr, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        // 16px minimum on mobile: anything smaller makes iOS Safari zoom the
        // page on focus, which breaks the layout mid-form.
        className={cn(
          inputBase,
          'h-12 text-base sm:text-[0.9375rem]',
          error ? 'border-[#FF8A9B]/60' : 'border-white/10',
          ltr && 'text-left [direction:ltr]',
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FieldShell label={label} htmlFor={selectId} error={error} hint={hint} required={required}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          className={cn(
            inputBase,
            'h-12 appearance-none pe-10 text-base sm:text-[0.9375rem]',
            error ? 'border-[#FF8A9B]/60' : 'border-white/10',
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled} className="bg-ink-800">
              {o.label}
            </option>
          ))}
        </select>
        {/* pointer-events-none so the chevron never swallows a tap. */}
        <svg
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-ink-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </FieldShell>
  );
});

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="space-y-2">
      {/* The whole row is the target — a 16px checkbox alone is not tappable. */}
      <label
        htmlFor={inputId}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
          error ? 'border-[#FF8A9B]/60' : 'border-white/10 hover:border-white/20',
          className,
        )}
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-burgundy-500"
          {...props}
        />
        <span className="text-sm leading-relaxed text-ink-100">{label}</span>
      </label>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-[#FF8A9B]">
          {error}
        </p>
      )}
    </div>
  );
});
