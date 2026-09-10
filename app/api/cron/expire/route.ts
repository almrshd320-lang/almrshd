import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { safeEqual } from '@/lib/security/tokens';

/**
 * Reservation expiry job.
 *
 * Migration 0012 schedules this in pg_cron where the extension is available;
 * this route is the alternative for projects without it (Vercel Cron, an
 * external scheduler, or a manual trigger).
 *
 * Running it twice concurrently is safe: expire_reservations() takes
 * FOR UPDATE SKIP LOCKED, and every restoration is guarded by the
 * stock_released flag, so a reservation can only ever give its unit back once.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.length < 16) {
    console.error('[cron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  // Accepts either Vercel Cron's Authorization header or an explicit
  // ?secret= parameter, compared in constant time.
  const authHeader = request.headers.get('authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const queryToken = request.nextUrl.searchParams.get('secret') ?? '';

  const authorised =
    (bearer.length > 0 && safeEqual(bearer, secret)) ||
    (queryToken.length > 0 && safeEqual(queryToken, secret));

  if (!authorised) {
    // No detail: this endpoint should look identical to an attacker whether the
    // secret is wrong or the route does not exist.
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const [{ data: expired, error: expireError }, { data: pruned }] = await Promise.all([
      supabase.rpc('expire_reservations', { p_batch_limit: 500 }),
      supabase.rpc('prune_rate_limits'),
    ]);

    if (expireError) {
      console.error('[cron] expiry failed', expireError.message);
      return NextResponse.json({ error: 'expiry failed' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      expired: expired ?? 0,
      rateLimitRowsPruned: pruned ?? 0,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cron] unexpected failure', error);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
