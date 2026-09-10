/**
 * Small utilities. Deliberately dependency-free — `cn` here replaces
 * clsx + tailwind-merge, which is two packages for something this project
 * needs in one simple form.
 */

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Arabic formatting ───────────────────────────────────────────────────────

const AR_LOCALE = 'ar-LY';

/**
 * Numbers use Latin digits even in Arabic UI. Libyan users read prices, dates
 * and quantities in Latin numerals in practice, and mixing numeral systems on
 * one page reads as a bug rather than a flourish.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatCurrencyLyd(value: number): string {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} د.ل`;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(AR_LOCALE, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      numberingSystem: 'latn',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(AR_LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      numberingSystem: 'latn',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(AR_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      numberingSystem: 'latn',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** "قبل ٣ ساعات" style relative time, for admin tables. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const diffSeconds = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(AR_LOCALE, { numeric: 'auto' });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return rtf.format(diffSeconds, 'second');
}

// ─── Countdown ───────────────────────────────────────────────────────────────

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  expired: boolean;
}

/**
 * @param targetIso     when booking opens
 * @param serverOffsetMs difference between the server clock and this browser's,
 *                       so a device with a wrong system time still counts down
 *                       to the right moment.
 */
export function computeCountdown(
  targetIso: string | null,
  serverOffsetMs = 0,
): Countdown {
  if (!targetIso) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true };
  }

  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true };
  }

  const now = Date.now() + serverOffsetMs;
  const total = Math.max(target - now, 0);

  return {
    days: Math.floor(total / 86400000),
    hours: Math.floor((total % 86400000) / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
    seconds: Math.floor((total % 60000) / 1000),
    total,
    expired: total <= 0,
  };
}

/** Pads to two digits without switching numeral systems. */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older Safari; only used for idempotency keys.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
