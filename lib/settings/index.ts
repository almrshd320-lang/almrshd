import 'server-only';

import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { PublicSettings, BookingWindow } from '@/types/domain';

/**
 * Settings access.
 *
 * Nothing in the app reads a business rule from a constant. Store name, launch
 * time, expiry window, which delivery methods are on — all of it comes from
 * app_settings, and all of it is editable by an admin without a deploy.
 */

const DEFAULTS: PublicSettings = {
  storeName: 'المرشد',
  storeNameEn: 'Al-Murshid',
  bookingEnabled: false,
  maintenanceMode: false,
  maintenanceMessageAr: 'الحجوزات متوقفة مؤقتًا.',
  bookingLaunchAt: null,
  reservationExpiryHours: 48,
  pickupEnabled: true,
  deliveryEnabled: true,
  contactPhone: '',
  whatsappNumber: '',
  announcementAr: '',
  socialInstagram: '',
  socialFacebook: '',
  socialTiktok: '',
  trustPickupNoteAr: '',
  trustDeliveryNoteAr: '',
  trustPaymentNoteAr: '',
  primaryProductSlug: '',
  compareProductSlugs: [],
};

/** snake_case setting key → camelCase field on PublicSettings. */
const KEY_MAP: Record<string, keyof PublicSettings> = {
  store_name: 'storeName',
  store_name_en: 'storeNameEn',
  booking_enabled: 'bookingEnabled',
  maintenance_mode: 'maintenanceMode',
  maintenance_message_ar: 'maintenanceMessageAr',
  booking_launch_at: 'bookingLaunchAt',
  reservation_expiry_hours: 'reservationExpiryHours',
  pickup_enabled: 'pickupEnabled',
  delivery_enabled: 'deliveryEnabled',
  contact_phone: 'contactPhone',
  whatsapp_number: 'whatsappNumber',
  announcement_ar: 'announcementAr',
  social_instagram: 'socialInstagram',
  social_facebook: 'socialFacebook',
  social_tiktok: 'socialTiktok',
  trust_pickup_note_ar: 'trustPickupNoteAr',
  trust_delivery_note_ar: 'trustDeliveryNoteAr',
  trust_payment_note_ar: 'trustPaymentNoteAr',
  primary_product_slug: 'primaryProductSlug',
  compare_product_slugs: 'compareProductSlugs',
};

/**
 * Public settings, read through the `is_public`-filtered view. Private keys
 * such as show_exact_stock are simply not in this result set.
 */
export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.from('v_public_settings').select('key, value');

    if (error || !data) {
      console.error('[settings] read failed', error?.message);
      return DEFAULTS;
    }

    const result: PublicSettings = { ...DEFAULTS };
    for (const row of data as { key: string; value: unknown }[]) {
      const field = KEY_MAP[row.key];
      if (!field) continue;
      // jsonb comes back already parsed. The key→field mapping is heterogeneous
      // by construction (booleans, numbers, strings, arrays), so the assignment
      // goes through `unknown` rather than pretending one type covers them all.
      (result as unknown as Record<string, unknown>)[field] = row.value;
    }
    return result;
  } catch (err) {
    console.error('[settings] unavailable, using defaults', err);
    return DEFAULTS;
  }
});

/**
 * The authoritative booking window.
 *
 * The hero countdown is a rendering of this; it is not the rule. The same
 * function is consulted again inside create_reservation(), so a customer whose
 * tab has been open since before launch still cannot slip through.
 */
export const getBookingWindow = cache(async (): Promise<BookingWindow> => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('booking_window_state');

    if (error || !data) {
      console.error('[settings] booking window read failed', error?.message);
      return {
        isOpen: false,
        reason: 'NOT_CONFIGURED',
        launchAt: null,
        serverTime: new Date().toISOString(),
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      isOpen: Boolean(row?.is_open),
      reason: (row?.reason ?? 'NOT_CONFIGURED') as BookingWindow['reason'],
      launchAt: row?.launch_at ?? null,
      serverTime: row?.server_time ?? new Date().toISOString(),
    };
  } catch (err) {
    console.error('[settings] booking window unavailable', err);
    return {
      isOpen: false,
      reason: 'NOT_CONFIGURED',
      launchAt: null,
      serverTime: new Date().toISOString(),
    };
  }
});
