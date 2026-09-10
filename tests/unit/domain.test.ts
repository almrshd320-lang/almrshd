import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeCountdown, pad2, formatCurrencyLyd, cn } from '@/lib/utils';
import {
  RESERVATION_STATUS,
  TIMELINE_STEPS,
  AVAILABILITY,
  toArabicError,
} from '@/config/statuses';
import type { ReservationStatus } from '@/types/domain';

describe('computeCountdown', () => {
  afterEach(() => vi.useRealTimers());

  it('counts down to the target', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const result = computeCountdown('2026-01-03T04:05:06Z');
    expect(result).toMatchObject({ days: 2, hours: 4, minutes: 5, seconds: 6, expired: false });
  });

  it('reports expiry once the target has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'));

    const result = computeCountdown('2026-01-01T00:00:00Z');
    expect(result.expired).toBe(true);
    expect(result.total).toBe(0);
    // Never negative: a passed target reads as zeroes, not as minus two days.
    expect(result.days).toBe(0);
  });

  it('corrects for a wrong client clock using the server offset', () => {
    vi.useFakeTimers();
    // This device thinks it is a full day earlier than it is.
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const offset = 24 * 3600 * 1000; // server is 1 day ahead of this browser
    const result = computeCountdown('2026-01-03T00:00:00Z', offset);

    // Without the offset this would read 2 days. With it, the true 1 day.
    expect(result.days).toBe(1);
  });

  it('treats a missing or malformed target as expired rather than crashing', () => {
    expect(computeCountdown(null).expired).toBe(true);
    expect(computeCountdown('not-a-date').expired).toBe(true);
  });

  it('pads without switching numeral systems', () => {
    expect(pad2(7)).toBe('07');
    expect(pad2(42)).toBe('42');
  });
});

describe('reservation status metadata', () => {
  it('has Arabic text for every status', () => {
    const statuses: ReservationStatus[] = [
      'RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY',
      'DELIVERED', 'CANCELLED', 'EXPIRED',
    ];
    for (const status of statuses) {
      expect(RESERVATION_STATUS[status].ar.length).toBeGreaterThan(0);
      expect(RESERVATION_STATUS[status].description.length).toBeGreaterThan(0);
    }
  });

  it('never shows OUT_FOR_DELIVERY on a pickup timeline', () => {
    // A pickup reservation cannot enter that state, so the customer must never
    // see a step they will never reach.
    expect(TIMELINE_STEPS.PICKUP).not.toContain('OUT_FOR_DELIVERY');
    expect(TIMELINE_STEPS.DELIVERY).toContain('OUT_FOR_DELIVERY');
  });

  it('keeps terminal statuses off the happy path', () => {
    for (const status of ['CANCELLED', 'EXPIRED'] as ReservationStatus[]) {
      expect(RESERVATION_STATUS[status].step).toBe(-1);
      expect(TIMELINE_STEPS.PICKUP).not.toContain(status);
      expect(TIMELINE_STEPS.DELIVERY).not.toContain(status);
    }
  });
});

describe('availability metadata', () => {
  it('pairs every state with an icon as well as a colour', () => {
    // WCAG 1.4.1: colour alone must not carry the meaning.
    for (const key of ['IN_STOCK', 'LIMITED', 'SOLD_OUT', 'UNAVAILABLE'] as const) {
      expect(AVAILABILITY[key].icon).toBeTruthy();
      expect(AVAILABILITY[key].ar.length).toBeGreaterThan(0);
    }
  });

  it('marks unavailable states as unselectable', () => {
    expect(AVAILABILITY.SOLD_OUT.selectable).toBe(false);
    expect(AVAILABILITY.UNAVAILABLE.selectable).toBe(false);
    expect(AVAILABILITY.IN_STOCK.selectable).toBe(true);
    expect(AVAILABILITY.LIMITED.selectable).toBe(true);
  });
});

describe('toArabicError', () => {
  it('maps known database error codes', () => {
    expect(toArabicError('OUT_OF_STOCK')).toContain('نفدت');
    expect(toArabicError('INVALID_PHONE')).toContain('الهاتف');
  });

  it('matches on the prefix before a colon', () => {
    expect(toArabicError('BOOKING_CLOSED:MAINTENANCE')).toContain('مؤقت');
    // An unrecognised suffix still resolves through the prefix.
    expect(toArabicError('BOOKING_CLOSED:SOMETHING_NEW')).toContain('الحجز');
  });

  it('never leaks a raw database message', () => {
    const raw = 'duplicate key value violates unique constraint "reservations_code_key"';
    const message = toArabicError(raw);
    expect(message).not.toContain('constraint');
    expect(message).not.toContain('reservations_code_key');
  });

  it('handles null and empty input', () => {
    expect(toArabicError(null).length).toBeGreaterThan(0);
    expect(toArabicError('').length).toBeGreaterThan(0);
  });
});

describe('formatting helpers', () => {
  it('formats LYD with the Arabic currency suffix', () => {
    expect(formatCurrencyLyd(5499)).toBe('5,499 د.ل');
    expect(formatCurrencyLyd(0)).toBe('0 د.ل');
  });

  it('joins class names and drops falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
