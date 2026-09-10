'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-burgundy-600 text-white hover:bg-burgundy-500 active:bg-burgundy-700 ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]',
  secondary:
    'bg-white/[0.06] text-ink-50 border border-white/12 hover:bg-white/[0.1] active:bg-white/[0.14]',
  ghost: 'text-ink-100 hover:bg-white/[0.06] active:bg-white/[0.09]',
  danger: 'bg-[#A32E3E] text-white hover:bg-[#B5384A] active:bg-[#8E2434]',
  quiet: 'bg-ink-100 text-ink-800 hover:bg-ink-200 active:bg-ink-300',
};

const SIZES: Record<Size, string> = {
  // 44px minimum touch target on every size — the whole booking flow is used
  // one-handed on a phone.
  sm: 'h-10 px-4 text-sm rounded-lg gap-1.5',
  md: 'h-12 px-6 text-[0.9375rem] rounded-xl gap-2',
  lg: 'h-14 px-8 text-base rounded-xl gap-2.5',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  /** Announced to screen readers while `loading` is true. */
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    loadingLabel = 'جارٍ التنفيذ',
    disabled,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  // A loading button is also a disabled button. This is what stops a
  // double-tap from creating two reservations before the first response lands.
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold',
        'transition-[background-color,transform,opacity] duration-200',
        'active:scale-[0.985]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {loading ? <span>{loadingLabel}</span> : children}
    </button>
  );
});
