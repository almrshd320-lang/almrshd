import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Privacy-conscious analytics.
 *
 * What is recorded: which step of the funnel was reached, which colour and
 * capacity were chosen, pickup vs delivery. What is NOT recorded: IP address,
 * name, phone, city, user agent, or any identifier that could be joined back to
 * a person. There is no cookie and no third-party script.
 */

export type AnalyticsEvent =
  | 'page_view'
  | 'product_interaction'
  | 'color_selected'
  | 'capacity_selected'
  | 'model_selected'
  | 'viewer_3d_opened'
  | 'booking_started'
  | 'booking_step_completed'
  | 'reservation_completed'
  | 'reservation_tracked';

/** Only these property names are ever written. Anything else is dropped. */
const ALLOWED_PROPERTIES = new Set([
  'step',
  'color_key',
  'capacity_key',
  'product_slug',
  'delivery_method',
  'section',
  'replay',
]);

function sanitize(properties: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;
    if (typeof value === 'string') clean[key] = value.slice(0, 64);
    else if (typeof value === 'number' || typeof value === 'boolean') clean[key] = value;
  }
  return clean;
}

/**
 * Records an event. Never throws and never blocks the user's request path —
 * analytics failing is not a reason for a reservation to fail.
 */
export async function track(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('analytics_events').insert({
      event,
      session_hash: null,
      properties: sanitize(properties),
    });
  } catch (err) {
    console.error('[analytics] write failed (ignored)', err);
  }
}
