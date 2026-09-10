'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The selectable card used by every choice step.
 *
 * A real <button> with aria-pressed rather than a styled div: it is reachable by
 * keyboard, announced as a control, and works with a screen reader without any
 * extra wiring. Disabled cards keep their text legible — a sold-out colour still
 * has to be readable, it just cannot be chosen.
 */

interface OptionCardProps {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  leading?: React.ReactNode;
  className?: string;
}

export function OptionCard({
  selected, disabled = false, onSelect, title, subtitle, badge, leading, className,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group relative flex w-full items-center gap-4 rounded-2xl border p-4 text-start transition-all duration-200',
        // 64px tall minimum: comfortable to hit with a thumb on a small phone.
        'min-h-16',
        selected
          ? 'border-burgundy-400/60 bg-burgundy-500/[0.1]'
          : 'border-white/10 bg-white/[0.02]',
        !disabled && !selected && 'hover:border-white/20 hover:bg-white/[0.05]',
        !disabled && 'active:scale-[0.99]',
        disabled && 'cursor-not-allowed opacity-55',
        className,
      )}
    >
      {leading}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-medium text-ink-50">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-ink-400">{subtitle}</span>}
      </span>

      {badge}

      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
          selected ? 'border-burgundy-400 bg-burgundy-500' : 'border-white/20',
        )}
        aria-hidden="true"
      >
        {selected && <Check className="size-3 text-white" />}
      </span>
    </button>
  );
}
