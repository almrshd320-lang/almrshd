'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { RESERVATION_STATUS, TIMELINE_STEPS } from '@/config/statuses';
import { formatDateTime, cn } from '@/lib/utils';
import type { ReservationStatus, DeliveryMethod, ReservationTimelineEntry } from '@/types/domain';

/**
 * Vertical reservation timeline.
 *
 * The steps shown depend on the delivery method — a pickup reservation never
 * displays "قيد التوصيل", because it can never enter that state. Cancelled and
 * expired reservations leave the happy path entirely and render as a terminal
 * state instead of a half-filled progress bar.
 */

interface TimelineProps {
  status: ReservationStatus;
  deliveryMethod: DeliveryMethod;
  entries: ReservationTimelineEntry[];
  className?: string;
}

export function ReservationTimeline({ status, deliveryMethod, entries, className }: TimelineProps) {
  const reduceMotion = useReducedMotion();
  const steps = TIMELINE_STEPS[deliveryMethod];

  const timestampFor = (step: ReservationStatus): string | null =>
    entries.find((e) => e.toStatus === step)?.createdAt ?? null;

  const isTerminal = status === 'CANCELLED' || status === 'EXPIRED';
  const currentIndex = steps.indexOf(status);

  return (
    <div className={cn('space-y-1', className)}>
      {isTerminal && (
        <div
          className="mb-6 flex items-start gap-3 rounded-2xl border border-[#FF8A9B]/25 bg-[#FF8A9B]/[0.07] px-5 py-4"
          role="status"
        >
          <X className="mt-0.5 size-5 shrink-0 text-[#FF8A9B]" aria-hidden="true" />
          <div>
            <p className="font-semibold text-ink-50">{RESERVATION_STATUS[status].ar}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-400">
              {RESERVATION_STATUS[status].description}
            </p>
          </div>
        </div>
      )}

      <ol className={cn('relative', isTerminal && 'opacity-45')}>
        {steps.map((step, index) => {
          const meta = RESERVATION_STATUS[step];
          const timestamp = timestampFor(step);
          const isDone = !isTerminal && currentIndex >= 0 && index < currentIndex;
          const isCurrent = !isTerminal && step === status;
          const isUpcoming = !isDone && !isCurrent;
          const isLast = index === steps.length - 1;

          return (
            <motion.li
              key={step}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : index * 0.07 }}
              className="relative flex gap-4 pb-8 last:pb-0"
            >
              {/* Connector. Rendered before the marker so it sits behind it. */}
              {!isLast && (
                <span
                  className={cn(
                    'absolute top-9 h-[calc(100%-1.25rem)] w-px',
                    // RTL: the rail runs down the right-hand side.
                    'right-[0.9375rem]',
                    isDone ? 'bg-burgundy-500/60' : 'bg-white/10',
                  )}
                  aria-hidden="true"
                />
              )}

              <span
                className={cn(
                  'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors',
                  isDone && 'border-burgundy-500 bg-burgundy-500 text-white',
                  isCurrent && 'border-burgundy-400 bg-ink-900 text-burgundy-300',
                  isUpcoming && 'border-white/12 bg-ink-900 text-ink-600',
                )}
                aria-hidden="true"
              >
                {isDone ? (
                  <Check className="size-4" />
                ) : isCurrent ? (
                  <span className="size-2.5 animate-pulse rounded-full bg-burgundy-400" />
                ) : (
                  <Clock className="size-3.5" />
                )}
              </span>

              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    'text-[0.9375rem] font-medium',
                    isUpcoming ? 'text-ink-500' : 'text-ink-50',
                  )}
                >
                  {meta.ar}
                  {isCurrent && (
                    <span className="ms-2 rounded-full bg-burgundy-500/15 px-2 py-0.5 text-[0.6875rem] text-burgundy-300">
                      الحالة الحالية
                    </span>
                  )}
                </p>

                <p
                  className={cn(
                    'mt-1 text-sm leading-relaxed',
                    isUpcoming ? 'text-ink-600' : 'text-ink-400',
                  )}
                >
                  {meta.description}
                </p>

                {timestamp && (
                  <p className="mt-1.5 text-xs text-ink-500">{formatDateTime(timestamp)}</p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
