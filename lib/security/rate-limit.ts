import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { hashIdentifier } from './tokens';

/**
 * Rate limiting.
 *
 * Vercel functions are stateless and short-lived, so an in-memory counter would
 * reset constantly and differ per region. The counter lives in Postgres, in a
 * fixed window, upserted atomically.
 */

export const RATE_LIMITS = {
  /** Reservation creation, per IP. Generous enough for a family sharing a connection. */
  reservation_create: { max: 5, windowSeconds: 600 },
  /** Reservation creation, per phone number. One device, one person. */
  reservation_create_phone: { max: 2, windowSeconds: 3600 },
  /** Tracking lookups, per IP — the enumeration surface. */
  track_lookup: { max: 10, windowSeconds: 600 },
  /** QR scans, per admin. High: a launch-day queue moves fast. */
  qr_validate: { max: 120, windowSeconds: 60 },
  /** Admin sign-in, per IP. */
  admin_login: { max: 5, windowSeconds: 900 },
  /** Analytics, per session. */
  analytics: { max: 60, windowSeconds: 300 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
}

/**
 * @param bucket     which limit to apply
 * @param identifier raw identifier (IP, phone, user id) — hashed before storage
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[bucket];
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_bucket: bucket,
    p_identifier_hash: hashIdentifier(identifier),
    p_max: config.max,
    p_window_seconds: config.windowSeconds,
  });

  if (error) {
    // A limiter that fails closed would take the whole site down with it.
    // Log loudly and let the request through — the RPCs behind it still
    // validate everything, and stock is protected by the row lock regardless.
    console.error('[rate-limit] check failed, allowing request', {
      bucket,
      error: error.message,
    });
    return { allowed: true, remaining: 0, resetAt: null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { allowed: true, remaining: 0, resetAt: null };

  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    resetAt: row.reset_at ? new Date(row.reset_at) : null,
  };
}
