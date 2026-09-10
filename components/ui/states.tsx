import { PackageOpen, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Loading, empty and error states.
 *
 * A shared vocabulary for "nothing here yet" and "something broke", so the app
 * never falls back to a blank region or a raw error string.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function LoadingState({
  label = 'جارٍ التحميل…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-16 text-ink-400', className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = PackageOpen,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <Icon className="size-6 text-ink-400" />
      </div>
      <h3 className="text-base font-semibold text-ink-100">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-ink-400">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'حدث خطأ',
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border ' +
          'border-[#FF8A9B]/20 bg-[#FF8A9B]/[0.06] px-6 py-12 text-center',
        className,
      )}
    >
      <AlertTriangle className="size-6 text-[#FF8A9B]" aria-hidden="true" />
      <h3 className="text-base font-semibold text-ink-50">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-ink-300">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Inline form-level error, above a submit button. */
export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-xl border border-[#FF8A9B]/25 bg-[#FF8A9B]/[0.08] ' +
          'px-4 py-3 text-sm leading-relaxed text-[#FFB3BF]',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
