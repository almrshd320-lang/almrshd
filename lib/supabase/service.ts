// The single most important line in the repository.
//
// `server-only` makes importing this module from a Client Component a BUILD
// error rather than a runtime surprise. The service-role key bypasses Row Level
// Security entirely; if it ever reached a browser bundle, every guarantee in
// this codebase would be void.
import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/**
 * Privileged Supabase client. Used ONLY by:
 *   • the reservation Server Actions (create / track / confirm),
 *   • the rate limiter,
 *   • the expiry cron route.
 *
 * These are exactly the paths where the caller is an anonymous customer with no
 * Supabase identity, so the work has to be done on their behalf by trusted
 * server code that validates everything first.
 *
 * Never pass user input straight through to this client. Every call site
 * validates with Zod and delegates to a SECURITY DEFINER function that
 * re-validates in SQL.
 */
export function createServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. This key is server-only and ' +
        'must never be given the NEXT_PUBLIC_ prefix.',
    );
  }

  // Defence in depth: a service-role key that somehow ends up in a public var
  // is a catastrophic misconfiguration, so fail loudly at boot.
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === serviceKey) {
    throw new Error(
      'FATAL: the service-role key is exposed as the public anon key. Fix .env before starting.',
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'al-murshid-server' } },
  });

  return cached;
}
