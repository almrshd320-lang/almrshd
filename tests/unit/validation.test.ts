import { describe, it, expect } from 'vitest';
import {
  normalizeLibyanPhone,
  formatLibyanPhone,
  libyanPhoneSchema,
  fullNameSchema,
  reservationCodeSchema,
  createReservationSchema,
  trackReservationSchema,
  setPriceSchema,
  adjustStockSchema,
  buildQrPayload,
  parseQrPayload,
} from '@/lib/validation/schemas';

/**
 * Validation tests.
 *
 * The phone cases here are the same set asserted against
 * normalize_libyan_phone() in tests/sql/behaviour.sql. Keeping both suites on
 * the same table is the point: if the TypeScript and SQL implementations ever
 * diverge, one of the two suites fails.
 */

describe('normalizeLibyanPhone', () => {
  it.each([
    ['0912345678', '218912345678', 'local 09… form'],
    ['0921234567', '218921234567', 'Libyana prefix'],
    ['0941234567', '218941234567', 'Al-Madar prefix'],
    ['912345678', '218912345678', 'bare nine digits'],
    ['218912345678', '218912345678', 'already normalised'],
    ['+218912345678', '218912345678', 'with plus'],
    ['+218 91 234 5678', '218912345678', 'with spaces'],
    ['00218912345678', '218912345678', '00218 prefix'],
    ['091-234-5678', '218912345678', 'with dashes'],
    ['(091) 2345678', '218912345678', 'with parentheses'],
    ['٠٩١٢٣٤٥٦٧٨', '218912345678', 'Arabic-Indic digits'],
  ])('normalises %s → %s (%s)', (input, expected) => {
    expect(normalizeLibyanPhone(input)).toBe(expected);
  });

  it.each([
    ['0812345678', 'invalid operator prefix'],
    ['0902345678', 'prefix 90 is not allocated'],
    ['0972345678', 'prefix 97 is not allocated'],
    ['091234', 'too short'],
    ['09123456789012', 'too long'],
    ['not a phone', 'non-numeric'],
    ['', 'empty'],
    ['+1 555 123 4567', 'non-Libyan number'],
  ])('rejects %s (%s)', (input) => {
    expect(normalizeLibyanPhone(input)).toBeNull();
  });

  it('handles null and undefined', () => {
    expect(normalizeLibyanPhone(null)).toBeNull();
    expect(normalizeLibyanPhone(undefined)).toBeNull();
  });

  it('round-trips back to the local display form', () => {
    expect(formatLibyanPhone('218912345678')).toBe('0912345678');
  });

  it('parses through the zod schema', () => {
    expect(libyanPhoneSchema.parse(' 091 234 5678 ')).toBe('218912345678');
    expect(libyanPhoneSchema.safeParse('0812345678').success).toBe(false);
  });
});

describe('fullNameSchema', () => {
  it('accepts Arabic and Latin names', () => {
    expect(fullNameSchema.safeParse('محمد علي').success).toBe(true);
    expect(fullNameSchema.safeParse('Mohamed Ali').success).toBe(true);
    expect(fullNameSchema.safeParse("O'Brien-Smith").success).toBe(true);
  });

  it('rejects markup and digits', () => {
    // The admin table renders these names; nothing that looks like markup
    // should get that far.
    expect(fullNameSchema.safeParse('<script>alert(1)</script>').success).toBe(false);
    expect(fullNameSchema.safeParse('محمد 123').success).toBe(false);
    expect(fullNameSchema.safeParse('ab').success).toBe(false);
    expect(fullNameSchema.safeParse('x'.repeat(200)).success).toBe(false);
  });
});

describe('reservationCodeSchema', () => {
  it('accepts a well-formed code', () => {
    expect(reservationCodeSchema.parse('MRSH-8K4P2X')).toBe('MRSH-8K4P2X');
  });

  it('uppercases and tolerates a missing dash', () => {
    expect(reservationCodeSchema.parse('mrsh-8k4p2x')).toBe('MRSH-8K4P2X');
    expect(reservationCodeSchema.parse('MRSH8K4P2X')).toBe('MRSH-8K4P2X');
  });

  it('rejects the ambiguous characters the generator never emits', () => {
    for (const char of ['I', 'L', 'O', 'U']) {
      expect(reservationCodeSchema.safeParse(`MRSH-8K4P2${char}`).success).toBe(false);
    }
  });

  it('rejects malformed input', () => {
    expect(reservationCodeSchema.safeParse('MRSH-123').success).toBe(false);
    expect(reservationCodeSchema.safeParse('ABCD-8K4P2X').success).toBe(false);
    expect(reservationCodeSchema.safeParse("MRSH-8K4P2X' OR 1=1--").success).toBe(false);
  });
});

describe('createReservationSchema', () => {
  const base = {
    variantId: '11111111-1111-4111-8111-111111111111',
    fullName: 'محمد علي',
    phone: '0912345678',
    city: 'طرابلس',
    confirmed: true as const,
  };

  it('accepts a valid pickup booking', () => {
    const result = createReservationSchema.safeParse({
      ...base,
      deliveryMethod: 'PICKUP',
      branchId: '22222222-2222-4222-8222-222222222222',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid delivery booking', () => {
    const result = createReservationSchema.safeParse({
      ...base,
      deliveryMethod: 'DELIVERY',
      deliveryCity: 'بنغازي',
    });
    expect(result.success).toBe(true);
  });

  it('refuses pickup without a branch', () => {
    expect(
      createReservationSchema.safeParse({ ...base, deliveryMethod: 'PICKUP' }).success,
    ).toBe(false);
  });

  it('refuses delivery without a city', () => {
    expect(
      createReservationSchema.safeParse({ ...base, deliveryMethod: 'DELIVERY' }).success,
    ).toBe(false);
  });

  it('refuses an unconfirmed submission', () => {
    expect(
      createReservationSchema.safeParse({
        ...base,
        confirmed: false,
        deliveryMethod: 'DELIVERY',
        deliveryCity: 'بنغازي',
      }).success,
    ).toBe(false);
  });

  it('ignores a price supplied by the client', () => {
    const result = createReservationSchema.safeParse({
      ...base,
      deliveryMethod: 'DELIVERY',
      deliveryCity: 'بنغازي',
      // A hostile client cannot introduce a price: the schema has no such
      // field, so it is stripped before anything reaches the server.
      price: 1,
      priceAtReservation: 1,
    });
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.success && result.data)).not.toContain('price');
  });

  it('refuses a non-uuid variant id', () => {
    expect(
      createReservationSchema.safeParse({
        ...base,
        variantId: 'not-a-uuid',
        deliveryMethod: 'DELIVERY',
        deliveryCity: 'بنغازي',
      }).success,
    ).toBe(false);
  });
});

describe('trackReservationSchema', () => {
  it('requires both factors', () => {
    expect(
      trackReservationSchema.safeParse({ code: 'MRSH-8K4P2X', phone: '0912345678' }).success,
    ).toBe(true);
    expect(trackReservationSchema.safeParse({ code: 'MRSH-8K4P2X' }).success).toBe(false);
    expect(trackReservationSchema.safeParse({ phone: '0912345678' }).success).toBe(false);
  });
});

describe('admin schemas', () => {
  const variantId = '11111111-1111-4111-8111-111111111111';

  it('rejects a negative price', () => {
    expect(setPriceSchema.safeParse({ variantId, price: -1 }).success).toBe(false);
  });

  it('rejects an absurd price', () => {
    expect(setPriceSchema.safeParse({ variantId, price: 10_000_000 }).success).toBe(false);
  });

  it('accepts a price supplied as a string from a form field', () => {
    const result = setPriceSchema.safeParse({ variantId, price: '5499.50' });
    expect(result.success && result.data.price).toBe(5499.5);
  });

  it('rejects a zero stock delta', () => {
    expect(adjustStockSchema.safeParse({ variantId, delta: 0 }).success).toBe(false);
    expect(adjustStockSchema.safeParse({ variantId, delta: -1 }).success).toBe(true);
  });
});

describe('QR payload', () => {
  const code = 'MRSH-8K4P2X';
  const token = 'a'.repeat(43);

  it('round-trips', () => {
    const parsed = parseQrPayload(buildQrPayload(code, token));
    expect(parsed).toEqual({ code, token });
  });

  it('rejects malformed payloads', () => {
    expect(parseQrPayload('')).toBeNull();
    expect(parseQrPayload('nonsense')).toBeNull();
    expect(parseQrPayload(`WRONG:${code}:${token}`)).toBeNull();
    expect(parseQrPayload(`MRSH1:${code}`)).toBeNull();
    expect(parseQrPayload(`MRSH1:BAD-CODE:${token}`)).toBeNull();
    expect(parseQrPayload(`MRSH1:${code}:short`)).toBeNull();
    expect(parseQrPayload(`MRSH1:${code}:${'a'.repeat(500)}`)).toBeNull();
  });

  it('carries no personal data', () => {
    const payload = buildQrPayload(code, token);
    expect(payload.split(':')).toHaveLength(3);
    // Exactly three segments: prefix, code, token. There is nowhere for a name,
    // a phone number or a price to hide.
    expect(payload).toBe(`MRSH1:${code}:${token}`);
  });
});
