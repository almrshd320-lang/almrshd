import { z } from 'zod';

/**
 * Validation schemas, in Arabic.
 *
 * These run on the client for immediate feedback AND on the server before any
 * database call. The database then validates a third time inside the RPC. The
 * client copy is a courtesy; the other two are the enforcement.
 */

// ─── Libyan phone numbers ────────────────────────────────────────────────────

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/**
 * Mirror of the SQL normalize_libyan_phone(). Accepts the four shapes Libyans
 * actually type and returns 218XXXXXXXXX, or null.
 *
 *   0912345678 · 912345678 · +218 91 234 5678 · 00218912345678
 */
export function normalizeLibyanPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  let digits = input.replace(ARABIC_DIGITS, (d) => ARABIC_DIGIT_MAP[d] ?? d);
  digits = digits.replace(/[^0-9]/g, '');

  if (digits.startsWith('00218')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('09')) digits = `218${digits.slice(1)}`;
  else if (digits.length === 9 && digits.startsWith('9')) digits = `218${digits}`;

  return /^218(9[1-6])[0-9]{7}$/.test(digits) ? digits : null;
}

/** 218912345678 → 0912345678, for display back to the customer. */
export function formatLibyanPhone(normalized: string): string {
  if (!/^218[0-9]{9}$/.test(normalized)) return normalized;
  return `0${normalized.slice(3)}`;
}

export const libyanPhoneSchema = z
  .string({ required_error: 'رقم الهاتف مطلوب' })
  .trim()
  .min(1, 'رقم الهاتف مطلوب')
  .transform((v) => normalizeLibyanPhone(v))
  .refine((v): v is string => v !== null, {
    message: 'رقم هاتف ليبي غير صحيح. مثال: 0912345678',
  });

// ─── Shared field schemas ────────────────────────────────────────────────────

export const fullNameSchema = z
  .string({ required_error: 'الاسم الكامل مطلوب' })
  .trim()
  .min(3, 'الاسم قصير جدًا')
  .max(120, 'الاسم طويل جدًا')
  // Arabic and Latin letters, spaces, apostrophes and hyphens. No digits, no
  // punctuation that could be used to smuggle markup into an admin table.
  .regex(
    /^[؀-ۿݐ-ݿA-Za-z\s'’\-.]+$/u,
    'يرجى إدخال اسم صحيح بالحروف فقط',
  );

export const citySchema = z
  .string({ required_error: 'المدينة مطلوبة' })
  .trim()
  .min(2, 'اسم المدينة قصير جدًا')
  .max(80, 'اسم المدينة طويل جدًا');

export const uuidSchema = z.string().uuid('معرّف غير صحيح');

export const reservationCodeSchema = z
  .string({ required_error: 'رقم الحجز مطلوب' })
  .trim()
  .toUpperCase()
  // Tolerate a missing dash: people retype these from a printed slip.
  .transform((v) => (/^MRSH[0-9A-HJKMNP-TV-Z]{6}$/.test(v) ? `MRSH-${v.slice(4)}` : v))
  .refine((v) => /^MRSH-[0-9A-HJKMNP-TV-Z]{6}$/.test(v), {
    message: 'رقم الحجز غير صحيح. مثال: MRSH-8K4P2X',
  });

// ─── Booking ─────────────────────────────────────────────────────────────────

export const bookingSelectionSchema = z.object({
  productId: uuidSchema,
  capacityId: uuidSchema,
  colorId: uuidSchema,
  variantId: uuidSchema,
});

export const customerDetailsSchema = z.object({
  fullName: fullNameSchema,
  phone: libyanPhoneSchema,
  city: citySchema,
});

/**
 * The whole booking payload. The discriminated union is what makes "pickup
 * needs a branch, delivery needs a city" a type-level fact rather than an
 * if-statement someone can forget.
 */
export const createReservationSchema = z
  .object({
    variantId: uuidSchema,
    fullName: fullNameSchema,
    phone: libyanPhoneSchema,
    city: citySchema,
    idempotencyKey: z.string().uuid().optional(),
    turnstileToken: z.string().optional(),
    confirmed: z.literal(true, {
      errorMap: () => ({ message: 'يرجى تأكيد صحة البيانات المدخلة' }),
    }),
  })
  .and(
    z.discriminatedUnion('deliveryMethod', [
      z.object({
        deliveryMethod: z.literal('PICKUP'),
        branchId: uuidSchema,
      }),
      z.object({
        deliveryMethod: z.literal('DELIVERY'),
        deliveryCity: citySchema,
      }),
    ]),
  );

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// ─── Tracking ────────────────────────────────────────────────────────────────

export const trackReservationSchema = z.object({
  code: reservationCodeSchema,
  phone: libyanPhoneSchema,
});

export type TrackReservationInput = z.infer<typeof trackReservationSchema>;

// ─── Admin ───────────────────────────────────────────────────────────────────

export const setPriceSchema = z.object({
  variantId: uuidSchema,
  price: z.coerce
    .number({ invalid_type_error: 'السعر يجب أن يكون رقمًا' })
    .min(0, 'السعر لا يمكن أن يكون سالبًا')
    .max(999999, 'السعر أكبر من الحد المسموح'),
  reason: z.string().trim().max(500, 'السبب طويل جدًا').optional(),
});

export const setStockSchema = z.object({
  variantId: uuidSchema,
  quantity: z.coerce
    .number({ invalid_type_error: 'الكمية يجب أن تكون رقمًا' })
    .int('الكمية يجب أن تكون عددًا صحيحًا')
    .min(0, 'الكمية لا يمكن أن تكون سالبة')
    .max(1000000, 'الكمية أكبر من الحد المسموح'),
  reason: z.string().trim().max(500).optional(),
});

export const adjustStockSchema = z.object({
  variantId: uuidSchema,
  delta: z.coerce
    .number({ invalid_type_error: 'القيمة يجب أن تكون رقمًا' })
    .int()
    .refine((v) => v !== 0, 'القيمة لا يمكن أن تكون صفرًا')
    .refine((v) => Math.abs(v) <= 100000, 'القيمة أكبر من الحد المسموح'),
  reason: z.string().trim().max(500).optional(),
});

export const updateStatusSchema = z.object({
  reservationId: uuidSchema,
  status: z.enum([
    'RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'CANCELLED', 'EXPIRED',
  ]),
  note: z.string().trim().max(500).optional(),
});

export const validateQrSchema = z.object({
  /** Raw QR payload: MRSH1:<code>:<token> */
  payload: z.string().trim().min(10, 'محتوى الرمز غير صالح').max(500),
  branchId: uuidSchema.optional(),
});

export const adminSignInSchema = z.object({
  email: z.string().trim().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(8, 'كلمة المرور قصيرة جدًا').max(200),
});

export const reservationFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z
    .enum(['RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'EXPIRED'])
    .optional(),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']).optional(),
  productId: uuidSchema.optional(),
  capacityId: uuidSchema.optional(),
  colorId: uuidSchema.optional(),
  branchId: uuidSchema.optional(),
  sort: z.enum(['newest', 'oldest', 'expiring']).default('newest'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export type ReservationFilter = z.infer<typeof reservationFilterSchema>;

// ─── QR payload ──────────────────────────────────────────────────────────────

/** MRSH1:<code>:<token> — versioned so the format can change later. */
export const QR_PREFIX = 'MRSH1';

export function buildQrPayload(code: string, token: string): string {
  return `${QR_PREFIX}:${code}:${token}`;
}

export function parseQrPayload(
  payload: string,
): { code: string; token: string } | null {
  const parts = payload.trim().split(':');
  if (parts.length !== 3) return null;
  const [prefix, code, token] = parts;
  if (prefix !== QR_PREFIX || !code || !token) return null;
  if (!/^MRSH-[0-9A-HJKMNP-TV-Z]{6}$/.test(code)) return null;
  if (token.length < 20 || token.length > 200) return null;
  return { code, token };
}
