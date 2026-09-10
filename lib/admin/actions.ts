'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { assertPermission } from '@/lib/auth/guard';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { clientIpFrom } from '@/lib/security/tokens';
import {
  setPriceSchema,
  setStockSchema,
  adjustStockSchema,
  updateStatusSchema,
  validateQrSchema,
  parseQrPayload,
} from '@/lib/validation/schemas';
import { toArabicError } from '@/config/statuses';
import type { ActionResult, QrScanResult } from '@/types/domain';

/**
 * Admin Server Actions.
 *
 * Each one is checked three times: here (for a readable error), inside the SQL
 * function via require_permission(), and by RLS on the tables the function
 * touches. The redundancy is deliberate — this is where money and inventory
 * change hands.
 *
 * All of these use the SESSION client, not the service role, so auth.uid()
 * resolves to a real person and the audit trail names them.
 */

// ─── Pricing ─────────────────────────────────────────────────────────────────

export async function setPriceAction(input: unknown): Promise<ActionResult<{ newPrice: number }>> {
  const guard = await assertPermission('manage_prices');
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = setPriceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_set_price', {
    p_variant_id: parsed.data.variantId,
    p_new_price: parsed.data.price,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    console.error('[admin] set price failed', error.message);
    return { ok: false, error: toArabicError(error.message) };
  }

  revalidatePath('/admin/pricing');
  return { ok: true, data: { newPrice: Number((data as { new_price: number }).new_price) } };
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export async function setStockAction(
  input: unknown,
): Promise<ActionResult<{ newQuantity: number }>> {
  const guard = await assertPermission('manage_stock');
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = setStockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_set_stock', {
    p_variant_id: parsed.data.variantId,
    p_new_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    console.error('[admin] set stock failed', error.message);
    return { ok: false, error: toArabicError(error.message) };
  }

  revalidatePath('/admin/stock');
  revalidatePath('/');
  return {
    ok: true,
    data: { newQuantity: Number((data as { new_quantity: number }).new_quantity) },
  };
}

export async function adjustStockAction(
  input: unknown,
): Promise<ActionResult<{ newQuantity: number }>> {
  const guard = await assertPermission('manage_stock');
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_adjust_stock', {
    p_variant_id: parsed.data.variantId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    console.error('[admin] adjust stock failed', error.message);
    return { ok: false, error: toArabicError(error.message) };
  }

  revalidatePath('/admin/stock');
  revalidatePath('/');
  return {
    ok: true,
    data: { newQuantity: Number((data as { new_quantity: number }).new_quantity) },
  };
}

// ─── Reservation status ──────────────────────────────────────────────────────

export async function updateStatusAction(
  input: unknown,
): Promise<ActionResult<{ newStatus: string }>> {
  const guard = await assertPermission('manage_reservations');
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_update_reservation_status', {
    p_reservation_id: parsed.data.reservationId,
    p_new_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    console.error('[admin] status update failed', error.message);
    return { ok: false, error: toArabicError(error.message) };
  }

  revalidatePath('/admin/reservations');
  revalidatePath(`/admin/reservations/${parsed.data.reservationId}`);
  return { ok: true, data: { newStatus: (data as { new_status: string }).new_status } };
}

// ─── QR validation ───────────────────────────────────────────────────────────

export async function validateQrAction(
  input: unknown,
): Promise<ActionResult<{ result: QrScanResult; code?: string; status?: string }>> {
  const guard = await assertPermission('scan_qr');
  if (!guard.ok) return { ok: false, error: guard.error };

  const parsed = validateQrSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'محتوى الرمز غير صالح.' };
  }

  const headerList = await headers();
  const limit = await checkRateLimit('qr_validate', guard.session.userId || clientIpFrom(headerList));
  if (!limit.allowed) {
    return { ok: false, error: toArabicError('RATE_LIMITED') };
  }

  // Parse the QR payload here so a malformed string never reaches the database.
  const payload = parseQrPayload(parsed.data.payload);
  if (!payload) {
    return { ok: true, data: { result: 'INVALID' } };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_validate_qr', {
    p_code: payload.code,
    p_token: payload.token,
    p_branch_id: parsed.data.branchId ?? null,
  });

  if (error) {
    console.error('[admin] qr validation failed', error.message);
    return { ok: false, error: toArabicError(error.message) };
  }

  const result = data as { result: QrScanResult; code?: string; status?: string };
  revalidatePath('/admin/scan');
  return { ok: true, data: result };
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function updateSettingAction(
  key: string,
  value: unknown,
): Promise<ActionResult<null>> {
  const guard = await assertPermission('manage_settings');
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!/^[a-z0-9_.]{2,64}$/.test(key)) {
    return { ok: false, error: 'مفتاح الإعداد غير صحيح.' };
  }

  const supabase = await createServerSupabase();

  const { data: previous } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();

  const { error } = await supabase
    .from('app_settings')
    .update({ value, updated_by: guard.session.userId })
    .eq('key', key);

  if (error) {
    console.error('[admin] setting update failed', error.message);
    return { ok: false, error: toArabicError(error.message) };
  }

  // Settings changes are consequential (they open and close the shop), so they
  // are audited like any other privileged action.
  await supabase.rpc('write_audit', {
    p_action: 'setting.update',
    p_entity_type: 'app_settings',
    p_entity_id: key,
    p_previous_value: previous?.value ?? null,
    p_new_value: value,
  });

  revalidatePath('/admin/settings');
  revalidatePath('/');
  return { ok: true, data: null };
}

// ─── Data retention ──────────────────────────────────────────────────────────

export async function anonymizeReservationAction(
  reservationId: string,
  reason?: string,
): Promise<ActionResult<null>> {
  const guard = await assertPermission('manage_reservations');
  if (!guard.ok) return { ok: false, error: guard.error };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_anonymize_reservation', {
    p_reservation_id: reservationId,
    p_reason: reason ?? null,
  });

  if (error) {
    console.error('[admin] anonymize failed', error.message);
    return { ok: false, error: toArabicError(error.message) };
  }

  revalidatePath('/admin/reservations');
  return { ok: true, data: null };
}
