'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { verifyCaptcha } from '@/lib/security/captcha';
import { generateAccessToken, hashToken, clientIpFrom } from '@/lib/security/tokens';
import {
  createReservationSchema,
  trackReservationSchema,
  reservationCodeSchema,
} from '@/lib/validation/schemas';
import { toArabicError } from '@/config/statuses';
import { mapReservation } from './mappers';
import { track } from '@/lib/analytics';
import type { ActionResult, CustomerReservation, CreatedReservation } from '@/types/domain';

/**
 * Customer-facing Server Actions.
 *
 * These are the ONLY way a customer reaches the reservation engine: the RPCs
 * are granted to service_role alone, so the browser cannot call them even with
 * a valid anon key. Every action here rate-limits, validates, and then delegates
 * to SQL that validates again.
 *
 * Note what is never read from the request: price, stock, status, expiry. All
 * of those are derived server-side. The client supplies a variant id and its own
 * contact details, and nothing else that matters.
 */

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createReservationAction(
  input: unknown,
): Promise<ActionResult<CreatedReservation>> {
  // 1. Shape and content validation.
  const parsed = createReservationSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first?.message ?? 'البيانات غير صحيحة', code: 'VALIDATION' };
  }
  const data = parsed.data;

  const headerList = await headers();
  const ip = clientIpFrom(headerList);

  // 2. Rate limiting: per IP and, more tightly, per phone number.
  const [byIp, byPhone] = await Promise.all([
    checkRateLimit('reservation_create', ip),
    checkRateLimit('reservation_create_phone', data.phone),
  ]);
  if (!byIp.allowed || !byPhone.allowed) {
    return { ok: false, error: toArabicError('RATE_LIMITED'), code: 'RATE_LIMITED' };
  }

  // 3. Optional bot check (a no-op until Turnstile keys are configured).
  const captcha = await verifyCaptcha(data.turnstileToken, ip);
  if (!captcha.ok) {
    return { ok: false, error: 'تعذّر التحقق من أنك لست روبوتًا.', code: 'CAPTCHA' };
  }

  // 4. Generate the access token HERE, on the server. The raw value goes back to
  //    this browser exactly once; only its SHA-256 reaches the database.
  const accessToken = generateAccessToken();
  const accessTokenHash = hashToken(accessToken);

  const supabase = createServiceClient();

  const { data: payload, error } = await supabase.rpc('create_reservation', {
    p_variant_id: data.variantId,
    p_customer_name: data.fullName,
    p_customer_phone: data.phone,
    p_customer_city: data.city,
    p_delivery_method: data.deliveryMethod,
    p_access_token_hash: accessTokenHash,
    p_branch_id: data.deliveryMethod === 'PICKUP' ? data.branchId : null,
    p_delivery_city: data.deliveryMethod === 'DELIVERY' ? data.deliveryCity : null,
    p_idempotency_key: data.idempotencyKey ?? null,
    p_source: 'WEB',
  });

  if (error) {
    // The RPC raises bare codes (OUT_OF_STOCK, BOOKING_CLOSED:…). Map them to
    // Arabic; never surface a raw database message to a customer.
    console.error('[reservation] create failed', { code: error.code, message: error.message });
    return {
      ok: false,
      error: toArabicError(error.message),
      code: error.message?.split(':')[0] ?? 'UNKNOWN',
    };
  }

  const reservation = mapReservation(payload);
  if (!reservation) {
    return { ok: false, error: toArabicError(null), code: 'UNKNOWN' };
  }

  await track('reservation_completed', {
    delivery_method: data.deliveryMethod,
    replay: reservation.idempotentReplay ?? false,
  });

  // An idempotent replay returns the ORIGINAL reservation — but this browser
  // holds a *different* raw token, which would not open it. Return an empty
  // token rather than a link that silently fails; the UI falls back to /track.
  if (reservation.idempotentReplay) {
    return { ok: true, data: { ...reservation, accessToken: '' } };
  }

  return { ok: true, data: { ...reservation, accessToken } };
}

// ─── Track ───────────────────────────────────────────────────────────────────

export async function trackReservationAction(
  input: unknown,
): Promise<ActionResult<CustomerReservation>> {
  const parsed = trackReservationSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: first?.message ?? 'البيانات غير صحيحة', code: 'VALIDATION' };
  }

  const headerList = await headers();
  const ip = clientIpFrom(headerList);

  const limit = await checkRateLimit('track_lookup', ip);
  if (!limit.allowed) {
    return { ok: false, error: toArabicError('RATE_LIMITED'), code: 'RATE_LIMITED' };
  }

  const supabase = createServiceClient();
  const { data: payload, error } = await supabase.rpc('track_reservation', {
    p_code: parsed.data.code,
    p_phone: parsed.data.phone,
  });

  if (error) {
    console.error('[reservation] track failed', error.message);
    return { ok: false, error: toArabicError(null), code: 'UNKNOWN' };
  }

  const reservation = mapReservation(payload);

  // One message for "no such code" and for "right code, wrong phone".
  // Distinguishing them would turn this into an oracle for probing which
  // reservation codes exist.
  if (!reservation) {
    return {
      ok: false,
      error: 'لم نعثر على حجز بهذه البيانات. تأكد من رقم الحجز ورقم الهاتف.',
      code: 'NOT_FOUND',
    };
  }

  await track('reservation_tracked', {});
  return { ok: true, data: reservation };
}

// ─── Confirmation page / bookmarked link ─────────────────────────────────────

export async function getReservationByTokenAction(
  code: string,
  token: string,
): Promise<ActionResult<CustomerReservation>> {
  const parsedCode = reservationCodeSchema.safeParse(code);
  if (!parsedCode.success || !token || token.length < 20 || token.length > 200) {
    return { ok: false, error: 'رابط غير صالح.', code: 'INVALID' };
  }

  const supabase = createServiceClient();
  const { data: payload, error } = await supabase.rpc('get_reservation_by_token', {
    p_code: parsedCode.data,
    p_token_hash: hashToken(token),
  });

  if (error) {
    console.error('[reservation] token lookup failed', error.message);
    return { ok: false, error: toArabicError(null), code: 'UNKNOWN' };
  }

  const reservation = mapReservation(payload);
  if (!reservation) {
    return { ok: false, error: 'رابط غير صالح أو منتهي الصلاحية.', code: 'NOT_FOUND' };
  }

  return { ok: true, data: reservation };
}
