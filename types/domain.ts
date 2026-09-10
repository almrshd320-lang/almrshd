/**
 * Domain types shared by server and client.
 *
 * These describe what the application deals in. Note what is absent: no
 * customer-facing type in this file carries a price, so a component cannot
 * render one even by accident — the type system refuses.
 */

export type ReservationStatus =
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED';

export type DeliveryMethod = 'PICKUP' | 'DELIVERY';

export type Availability = 'IN_STOCK' | 'LIMITED' | 'SOLD_OUT' | 'UNAVAILABLE';

export type QrScanResult = 'VALID' | 'ALREADY_USED' | 'INVALID' | 'NOT_ELIGIBLE';

export type Permission =
  | 'view_reservations'
  | 'manage_reservations'
  | 'manage_stock'
  | 'view_prices'
  | 'manage_prices'
  | 'scan_qr'
  | 'view_audit_logs'
  | 'manage_settings'
  | 'manage_products'
  | 'manage_users'
  | 'export_data';

// ─── Catalog (public) ────────────────────────────────────────────────────────

export interface PublicVariant {
  variantId: string;
  productId: string;
  productSlug: string;
  productNameAr: string;
  isBookable: boolean;
  capacityId: string;
  capacityKey: string;
  capacityLabelAr: string;
  sizeGb: number;
  colorId: string;
  colorKey: string;
  colorNameAr: string;
  colorHex: string;
  gradientFrom: string | null;
  gradientTo: string | null;
  colorImagePath: string | null;
  displayOrder: number;
  availability: Availability;
  /** Non-null only when an admin has explicitly enabled exact counts. */
  exactQuantity: number | null;
}

export interface PublicProduct {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  taglineAr: string | null;
  descriptionAr: string | null;
  generation: number | null;
  isBookable: boolean;
  /** True while the product is unannounced. The UI must label it as such. */
  isPlaceholder: boolean;
  heroImagePath: string | null;
  model3dPath: string | null;
  displayOrder: number;
}

export interface PublicSpec {
  id: string;
  productId: string;
  groupKey: string;
  key: string;
  labelAr: string;
  /** Null whenever isConfirmed is false — unverified values are withheld. */
  valueAr: string | null;
  valueNumeric: number | null;
  unitAr: string | null;
  icon: string | null;
  isConfirmed: boolean;
  isHighlight: boolean;
  displayOrder: number;
}

export interface PublicBranch {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  cityAr: string;
  addressAr: string | null;
  phone: string | null;
  mapsUrl: string | null;
  openingHours: Record<string, string>;
  displayOrder: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface PublicSettings {
  storeName: string;
  storeNameEn: string;
  bookingEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessageAr: string;
  bookingLaunchAt: string | null;
  reservationExpiryHours: number;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  contactPhone: string;
  whatsappNumber: string;
  announcementAr: string;
  socialInstagram: string;
  socialFacebook: string;
  socialTiktok: string;
  trustPickupNoteAr: string;
  trustDeliveryNoteAr: string;
  trustPaymentNoteAr: string;
  primaryProductSlug: string;
  compareProductSlugs: string[];
}

export interface BookingWindow {
  isOpen: boolean;
  reason: 'OPEN' | 'DISABLED' | 'MAINTENANCE' | 'NOT_YET_OPEN' | 'NOT_CONFIGURED';
  launchAt: string | null;
  /** Server clock, so the countdown never depends on the visitor's system time. */
  serverTime: string;
}

// ─── Reservations (customer-facing — deliberately price-free) ────────────────

export interface ReservationTimelineEntry {
  toStatus: ReservationStatus;
  createdAt: string;
}

export interface CustomerReservation {
  code: string;
  status: ReservationStatus;
  deliveryMethod: DeliveryMethod;
  createdAt: string;
  expiresAt: string;
  product: { slug: string; nameAr: string };
  capacity: { key: string; labelAr: string };
  color: { key: string; nameAr: string; hex: string };
  branch: {
    nameAr: string;
    cityAr: string;
    addressAr: string | null;
    phone: string | null;
    mapsUrl: string | null;
  } | null;
  deliveryCity: string | null;
  customerNameMasked: string;
  timeline: ReservationTimelineEntry[];
  idempotentReplay?: boolean;
}

/** Returned by the create action; carries the raw token exactly once. */
export interface CreatedReservation extends CustomerReservation {
  /** Never persisted in plaintext. Shown to this browser and then forgotten. */
  accessToken: string;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminReservationDetail {
  id: string;
  code: string;
  status: ReservationStatus;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  deliveryMethod: DeliveryMethod;
  deliveryCity: string | null;
  branch: { id: string; nameAr: string; cityAr: string } | null;
  product: { id: string; nameAr: string; slug: string };
  capacity: { key: string; labelAr: string };
  color: { key: string; nameAr: string; hex: string };
  variantId: string;
  expiresAt: string;
  qrUsedAt: string | null;
  stockReleased: boolean;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null unless the caller holds view_prices. Enforced in SQL, not here. */
  priceAtReservation: number | null;
  currency: string | null;
  canViewPrice: boolean;
  timeline: {
    fromStatus: ReservationStatus | null;
    toStatus: ReservationStatus;
    actor: 'SYSTEM' | 'ADMIN' | 'CUSTOMER';
    changedByEmail: string | null;
    note: string | null;
    createdAt: string;
  }[];
}

export interface DashboardMetrics {
  reservations: {
    total: number;
    received: number;
    confirmed: number;
    ready: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    expired: number;
    today: number;
    pickup: number;
    delivery: number;
  };
  inventory: {
    total_units: number;
    reserved_units: number;
    variants: number;
    low_stock: number;
    out_of_stock: number;
  };
}

export interface PricingRow {
  variant_id: string;
  sku: string;
  product_name_ar: string;
  capacity_key: string;
  capacity_label_ar: string;
  size_gb: number;
  color_name_ar: string;
  color_hex: string;
  price_lyd: number | null;
  currency: string | null;
  price_updated_at: string | null;
  price_updated_by: string | null;
  quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
}

export interface PriceHistoryRow {
  id: string;
  previous_price: number | null;
  new_price: number;
  currency: string;
  changed_by_email: string | null;
  reason: string | null;
  created_at: string;
}

// ─── Action results ──────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
