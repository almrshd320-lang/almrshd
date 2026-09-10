import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Health check for uptime monitoring.
 *
 * Reads one public view with the anonymous key — which also proves the public
 * read path still works, not merely that the process is alive. Deliberately
 * reports nothing about schema, version or configuration.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from('v_public_settings').select('key').limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'degraded', database: 'error' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { status: 'ok', database: 'ok', latencyMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'error' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
