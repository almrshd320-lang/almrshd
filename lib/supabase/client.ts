'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Carries the anonymous key, which is safe to ship:
 * `anon` has SELECT on the five v_public_* views and nothing else — no base
 * table, no function. See migration 0011.
 *
 * Used only by the admin sign-in screen and for session-aware admin reads.
 * Customer-facing writes never go through here; they go through Server Actions.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase environment is not configured. Copy .env.example to .env.local.',
    );
  }

  return createBrowserClient(url, key);
}
