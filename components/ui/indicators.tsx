import { Check, AlertTriangle, X, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AVAILABILITY, RESERVATION_STATUS } from '@/config/statuses';
import type { Availability, ReservationStatus } from '@/types/domain';

/**
 * Status and availability indicators.
 *
 * WCAG 1.4.1: availability is never communicated by colour alone. Every state
 * carries an icon and a word, so it survives greyscale, colour blindness and a
 * screen reader.
 */

const AVAILABILITY_TONE: Record<string, string> = {
  success: 'text-[#3FBE86] bg-[#3FBE86]/10 border-[#3FBE86]/25',
  warning: 'text-[#E2A63C] bg-[#E2A63C]/10 border-[#E2A63C]/25',
  danger: 'text-[#FF8A9B] bg-[#FF8A9B]/10 border-[#FF8A9B]/25',
  neutral: 'text-ink-400 bg-white/[0.04] border-white/10',
};

const AVAILABILITY_ICON = { check: Check, alert: AlertTriangle, x: X } as const;

export function StockIndicator({
  availability,
  size = 'md',
  className,
}: {
  availability: Availability;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = AVAILABILITY[availability];
  const Icon = AVAILABILITY_ICON[meta.icon];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-2.5 py-1 text-xs',
        AVAILABILITY_TONE[meta.tone],
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} aria-hidden="true" />
      {meta.ar}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  neutral: 'text-ink-200 bg-white/[0.06] border-white/12',
  progress: 'text-[#7FB6E8] bg-[#7FB6E8]/10 border-[#7FB6E8]/25',
  success: 'text-[#3FBE86] bg-[#3FBE86]/10 border-[#3FBE86]/25',
  danger: 'text-[#FF8A9B] bg-[#FF8A9B]/10 border-[#FF8A9B]/25',
};

/** Light-surface variant, for the admin tables. */
const STATUS_TONE_LIGHT: Record<string, string> = {
  neutral: 'text-ink-600 bg-ink-100 border-ink-200',
  progress: 'text-[#1D5A8C] bg-[#E5F0F9] border-[#BCD9EE]',
  success: 'text-[#12613C] bg-[#E3F5EC] border-[#B6E2CC]',
  danger: 'text-[#8E2434] bg-[#FBE9EC] border-[#F0C4CC]',
};

export function StatusBadge({
  status,
  light = false,
  className,
}: {
  status: ReservationStatus;
  light?: boolean;
  className?: string;
}) {
  const meta = RESERVATION_STATUS[status];
  const palette = light ? STATUS_TONE_LIGHT : STATUS_TONE;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        palette[meta.tone],
        className,
      )}
    >
      <Circle
        className={cn('size-2 fill-current', meta.tone === 'progress' && 'animate-pulse')}
        aria-hidden="true"
      />
      {meta.ar}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'muted';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        tone === 'accent' && 'border-burgundy-500/30 bg-burgundy-500/12 text-burgundy-300',
        tone === 'neutral' && 'border-white/12 bg-white/[0.06] text-ink-200',
        tone === 'muted' && 'border-white/8 bg-transparent text-ink-400',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Marks data that is not officially announced. Used wherever a spec row has
 * is_confirmed = false, so speculation is always visibly labelled as such.
 */
export function UnconfirmedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-dashed border-white/15 ' +
          'px-1.5 py-0.5 text-[0.6875rem] text-ink-400',
        className,
      )}
    >
      يُعلن لاحقًا
    </span>
  );
}
