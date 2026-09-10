import 'server-only';

import { createServerSupabase } from '@/lib/supabase/server';
import type {
  DashboardMetrics,
  AdminReservationDetail,
  PricingRow,
  PriceHistoryRow,
  ReservationStatus,
  DeliveryMethod,
} from '@/types/domain';
import type { ReservationFilter } from '@/lib/validation/schemas';

/**
 * Admin reads.
 *
 * Everything here uses the signed-in admin's session, so RLS applies. A staff
 * account calling getPricingOverview() gets an empty list — not because this
 * code checks, but because the database refuses.
 */

export const PAGE_SIZE = 25;

export interface AdminReservationRow {
  id: string;
  code: string;
  status: ReservationStatus;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  delivery_method: DeliveryMethod;
  delivery_city: string | null;
  branch_name_ar: string | null;
  product_name_ar: string;
  capacity_label_ar: string;
  color_name_ar: string;
  color_hex: string;
  expires_at: string;
  qr_used_at: string | null;
  created_at: string;
}

export async function getReservations(
  filter: ReservationFilter,
): Promise<{ rows: AdminReservationRow[]; total: number }> {
  const supabase = await createServerSupabase();

  let query = supabase
    .from('v_admin_reservations')
    .select('*', { count: 'exact' });

  if (filter.status) query = query.eq('status', filter.status);
  if (filter.deliveryMethod) query = query.eq('delivery_method', filter.deliveryMethod);
  if (filter.productId) query = query.eq('product_id', filter.productId);
  if (filter.capacityId) query = query.eq('capacity_id', filter.capacityId);
  if (filter.colorId) query = query.eq('color_id', filter.colorId);
  if (filter.branchId) query = query.eq('branch_id', filter.branchId);

  if (filter.q) {
    // Search reservation code, customer name or phone in one pass. The phone is
    // normalised in storage, so strip whatever the admin typed down to digits.
    const raw = filter.q.trim();
    const digits = raw.replace(/[^0-9]/g, '');
    const escaped = raw.replace(/[%,()]/g, '');
    const clauses = [
      `code.ilike.%${escaped.toUpperCase()}%`,
      `customer_name.ilike.%${escaped}%`,
    ];
    if (digits.length >= 4) clauses.push(`customer_phone.ilike.%${digits}%`);
    query = query.or(clauses.join(','));
  }

  switch (filter.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'expiring':
      query = query.order('expires_at', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const from = (filter.page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[admin] reservation list failed', error.message);
    return { rows: [], total: 0 };
  }

  return { rows: (data ?? []) as AdminReservationRow[], total: count ?? 0 };
}

export async function getReservationDetail(
  id: string,
): Promise<AdminReservationDetail | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_reservation_detail', {
    p_reservation_id: id,
  });

  if (error || !data) {
    console.error('[admin] reservation detail failed', error?.message);
    return null;
  }

  const raw = data as Record<string, unknown>;
  return {
    id: raw.id as string,
    code: raw.code as string,
    status: raw.status as ReservationStatus,
    customerName: raw.customer_name as string,
    customerPhone: raw.customer_phone as string,
    customerCity: raw.customer_city as string,
    deliveryMethod: raw.delivery_method as DeliveryMethod,
    deliveryCity: (raw.delivery_city as string) ?? null,
    branch: (raw.branch as AdminReservationDetail['branch']) ?? null,
    product: raw.product as AdminReservationDetail['product'],
    capacity: raw.capacity as AdminReservationDetail['capacity'],
    color: raw.color as AdminReservationDetail['color'],
    variantId: raw.variant_id as string,
    expiresAt: raw.expires_at as string,
    qrUsedAt: (raw.qr_used_at as string) ?? null,
    stockReleased: Boolean(raw.stock_released),
    internalNotes: (raw.internal_notes as string) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
    // Null whenever the caller lacks view_prices. Decided in SQL, not here.
    priceAtReservation:
      raw.price_at_reservation != null ? Number(raw.price_at_reservation) : null,
    currency: (raw.currency as string) ?? null,
    canViewPrice: Boolean(raw.can_view_price),
    timeline: (raw.timeline ?? []) as AdminReservationDetail['timeline'],
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_dashboard_metrics');

  if (error || !data) {
    console.error('[admin] metrics failed', error?.message);
    return null;
  }
  return data as DashboardMetrics;
}

export async function getPricingOverview(): Promise<PricingRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_pricing_overview');

  if (error) {
    console.error('[admin] pricing overview failed', error.message);
    return [];
  }
  return (data ?? []) as PricingRow[];
}

export async function getPriceHistory(variantId: string): Promise<PriceHistoryRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_price_history', {
    p_variant_id: variantId,
    p_limit: 50,
  });

  if (error) {
    console.error('[admin] price history failed', error.message);
    return [];
  }
  return (data ?? []) as PriceHistoryRow[];
}

export interface StockRow {
  variant_id: string;
  sku: string;
  product_name_ar: string;
  capacity_key: string;
  capacity_label_ar: string;
  size_gb: number;
  color_name_ar: string;
  color_hex: string;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  availability: string;
  updated_at: string;
}

export async function getStockBoard(): Promise<StockRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('v_admin_stock')
    .select('*')
    .order('product_order', { ascending: true })
    .order('size_gb', { ascending: true })
    .order('color_order', { ascending: true });

  if (error) {
    console.error('[admin] stock board failed', error.message);
    return [];
  }
  return (data ?? []) as StockRow[];
}

export interface AuditRow {
  id: number;
  actor_email: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reservation_code: string | null;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
}

export async function getAuditLog(page = 1, action?: string): Promise<{
  rows: AuditRow[];
  total: number;
}> {
  const supabase = await createServerSupabase();
  let query = supabase.from('v_admin_audit').select('*', { count: 'exact' });

  if (action) query = query.eq('action', action);

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error('[admin] audit log failed', error.message);
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}

export interface StockHistoryRow {
  id: string;
  variant_id: string;
  previous_quantity: number;
  new_quantity: number;
  delta: number;
  reason: string;
  changed_by_email: string | null;
  note: string | null;
  created_at: string;
  sku: string;
  product_name_ar: string;
  capacity_key: string;
  color_name_ar: string;
  reservation_code: string | null;
}

export async function getStockHistory(variantId?: string, limit = 50): Promise<StockHistoryRow[]> {
  const supabase = await createServerSupabase();
  let query = supabase.from('v_admin_stock_history').select('*');
  if (variantId) query = query.eq('variant_id', variantId);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[admin] stock history failed', error.message);
    return [];
  }
  return (data ?? []) as StockHistoryRow[];
}

export interface SettingRow {
  key: string;
  value: unknown;
  is_public: boolean;
  description: string | null;
  updated_at: string;
}

export async function getAllSettings(): Promise<SettingRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value, is_public, description, updated_at')
    .order('key', { ascending: true });

  if (error) {
    console.error('[admin] settings read failed', error.message);
    return [];
  }
  return (data ?? []) as SettingRow[];
}

/**
 * CSV export. Gated by export_data at the route level; this only builds the file.
 *
 * The internal price is included ONLY when the caller can see prices — the same
 * rule as the detail view, so an export is never a way around the permission.
 */
export async function buildReservationsCsv(includePrices: boolean): Promise<string> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('v_admin_reservations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AdminReservationRow[];

  let priceByReservation = new Map<string, number>();
  if (includePrices) {
    const { data: pricing } = await supabase
      .from('reservation_pricing')
      .select('reservation_id, price_at_reservation');
    priceByReservation = new Map(
      ((pricing ?? []) as { reservation_id: string; price_at_reservation: number }[]).map((p) => [
        p.reservation_id,
        Number(p.price_at_reservation),
      ]),
    );
  }

  const headers = [
    'رقم الحجز', 'الحالة', 'المنتج', 'السعة', 'اللون',
    'الاسم', 'الهاتف', 'المدينة', 'طريقة الاستلام', 'الفرع/مدينة التوصيل',
    'تاريخ الحجز', 'ينتهي في',
    ...(includePrices ? ['السعر الداخلي (د.ل)'] : []),
  ];

  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    // Neutralise spreadsheet formula injection: a cell starting with = + - @
    // is executed by Excel when opened.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(escape).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.code, r.status, r.product_name_ar, r.capacity_label_ar, r.color_name_ar,
        r.customer_name, r.customer_phone, r.customer_city, r.delivery_method,
        r.branch_name_ar ?? r.delivery_city ?? '',
        r.created_at, r.expires_at,
        ...(includePrices ? [priceByReservation.get(r.id) ?? ''] : []),
      ]
        .map(escape)
        .join(','),
    );
  }

  // BOM so Excel opens the Arabic correctly.
  return `﻿${lines.join('\r\n')}`;
}
