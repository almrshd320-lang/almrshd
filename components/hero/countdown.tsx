'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, CircleCheck, Wrench, CircleSlash } from 'lucide-react';
import { computeCountdown, pad2, formatDateTime, cn } from '@/lib/utils';
import type { BookingWindow } from '@/types/domain';

/**
 * Launch countdown.
 *
 * The countdown is a *display*. Whether booking is actually open is decided by
 * booking_window_state() in SQL and re-checked inside create_reservation(), so
 * a tab left open since before launch — or a device with a wrong clock — cannot
 * be used to reserve early.
 *
 * The clock skew problem is handled by taking the server's timestamp at render
 * and counting against that offset, not against the visitor's Date.now().
 */

interface CountdownProps {
  window: BookingWindow;
  maintenanceMessage: string;
  className?: string;
}

export function Countdown({ window: bookingWindow, maintenanceMessage, className }: CountdownProps) {
  const reduceMotion = useReducedMotion();

  // Difference between the server clock and this browser's, sampled once.
  const offsetRef = useRef<number>(
    new Date(bookingWindow.serverTime).getTime() - Date.now(),
  );

  const [remaining, setRemaining] = useState(() =>
    computeCountdown(bookingWindow.launchAt, offsetRef.current),
  );
  const [justOpened, setJustOpened] = useState(false);

  useEffect(() => {
    if (bookingWindow.reason !== 'NOT_YET_OPEN' || !bookingWindow.launchAt) return;

    const tick = () => {
      const next = computeCountdown(bookingWindow.launchAt, offsetRef.current);
      setRemaining(next);
      // Reaching zero client-side does NOT open booking. It prompts a refresh,
      // and the server decides.
      if (next.expired) setJustOpened(true);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [bookingWindow.launchAt, bookingWindow.reason]);

  // ── States other than "counting down" ─────────────────────────────────────

  if (bookingWindow.reason === 'MAINTENANCE') {
    return (
      <StatusPanel
        icon={Wrench}
        tone="warning"
        title="الحجوزات متوقفة مؤقتًا"
        description={maintenanceMessage || 'نعود إليكم قريبًا.'}
        className={className}
      />
    );
  }

  if (bookingWindow.reason === 'DISABLED') {
    return (
      <StatusPanel
        icon={CircleSlash}
        tone="neutral"
        title="الحجز مغلق حاليًا"
        description="تابعنا لمعرفة موعد فتح الحجز."
        className={className}
      />
    );
  }

  if (bookingWindow.reason === 'NOT_CONFIGURED') {
    return (
      <StatusPanel
        icon={CalendarClock}
        tone="neutral"
        title="موعد الحجز سيُعلن قريبًا"
        description="لم يُحدَّد موعد فتح الحجز بعد."
        className={className}
      />
    );
  }

  if (bookingWindow.isOpen) {
    return (
      <StatusPanel
        icon={CircleCheck}
        tone="success"
        title="الحجز مفتوح الآن"
        description="اختر جهازك وأكمل الحجز في أقل من دقيقة."
        className={className}
      />
    );
  }

  if (justOpened) {
    return (
      <StatusPanel
        icon={CircleCheck}
        tone="success"
        title="بدأ الحجز"
        description="حدّث الصفحة لبدء الحجز."
        className={className}
      />
    );
  }

  // ── Counting down ─────────────────────────────────────────────────────────

  const units = [
    { value: remaining.days, label: 'يوم' },
    { value: remaining.hours, label: 'ساعة' },
    { value: remaining.minutes, label: 'دقيقة' },
    { value: remaining.seconds, label: 'ثانية' },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-sm font-medium text-ink-400">يبدأ الحجز خلال</p>

      {/*
        A live region would announce every tick, which is unbearable with a
        screen reader. Instead the grid is aria-hidden and a single static
        sentence carries the information.
      */}
      <div
        className="flex items-stretch gap-2 sm:gap-3"
        aria-hidden="true"
        // LTR so days sit leftmost and seconds rightmost, which is how a
        // countdown is read even in Arabic layouts.
        dir="ltr"
      >
        {units.map((unit, index) => (
          <motion.div
            key={unit.label}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : index * 0.06, duration: 0.4 }}
            className="surface flex min-w-[4.25rem] flex-1 flex-col items-center justify-center px-2 py-3 sm:min-w-[5.5rem] sm:py-4"
          >
            <span className="font-mono text-2xl font-semibold tabular-nums text-ink-50 sm:text-4xl">
              {pad2(unit.value)}
            </span>
            <span className="mt-1 text-[0.6875rem] text-ink-400 sm:text-xs">{unit.label}</span>
          </motion.div>
        ))}
      </div>

      <p className="sr-only">
        يبدأ الحجز بعد {remaining.days} يومًا و{remaining.hours} ساعة و
        {remaining.minutes} دقيقة.
      </p>

      {bookingWindow.launchAt && (
        <p className="text-xs text-ink-500">
          موعد الفتح: {formatDateTime(bookingWindow.launchAt)}
        </p>
      )}
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  tone,
  title,
  description,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'success' | 'warning' | 'neutral';
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-5 py-4',
        tone === 'success' && 'border-[#3FBE86]/25 bg-[#3FBE86]/[0.07]',
        tone === 'warning' && 'border-[#E2A63C]/25 bg-[#E2A63C]/[0.07]',
        tone === 'neutral' && 'border-white/10 bg-white/[0.04]',
        className,
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-5 shrink-0',
          tone === 'success' && 'text-[#3FBE86]',
          tone === 'warning' && 'text-[#E2A63C]',
          tone === 'neutral' && 'text-ink-400',
        )}
      />
      <div>
        <p className="font-semibold text-ink-50">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-400">{description}</p>
      </div>
    </div>
  );
}
