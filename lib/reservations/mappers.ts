import type { CustomerReservation, ReservationStatus, DeliveryMethod } from '@/types/domain';

/**
 * Maps the jsonb payload from reservation_public_payload() into the domain type.
 *
 * The mapping is explicit field by field. That is the point: if someone ever
 * adds a column to the SQL payload, it does not silently flow through to the
 * client — it has to be named here first.
 */

interface RawPayload {
  code: string;
  status: string;
  delivery_method: string;
  created_at: string;
  expires_at: string;
  product: { slug: string; name_ar: string };
  capacity: { key: string; label_ar: string };
  color: { key: string; name_ar: string; hex: string };
  branch: {
    name_ar: string;
    city_ar: string;
    address_ar: string | null;
    phone: string | null;
    maps_url: string | null;
  } | null;
  delivery_city: string | null;
  customer_name_masked: string;
  timeline: { to_status: string; created_at: string }[];
  idempotent_replay?: boolean;
}

export function mapReservation(raw: unknown): CustomerReservation | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as RawPayload;
  if (!p.code) return null;

  return {
    code: p.code,
    status: p.status as ReservationStatus,
    deliveryMethod: p.delivery_method as DeliveryMethod,
    createdAt: p.created_at,
    expiresAt: p.expires_at,
    product: { slug: p.product.slug, nameAr: p.product.name_ar },
    capacity: { key: p.capacity.key, labelAr: p.capacity.label_ar },
    color: { key: p.color.key, nameAr: p.color.name_ar, hex: p.color.hex },
    branch: p.branch
      ? {
          nameAr: p.branch.name_ar,
          cityAr: p.branch.city_ar,
          addressAr: p.branch.address_ar,
          phone: p.branch.phone,
          mapsUrl: p.branch.maps_url,
        }
      : null,
    deliveryCity: p.delivery_city,
    customerNameMasked: p.customer_name_masked,
    timeline: (p.timeline ?? []).map((t) => ({
      toStatus: t.to_status as ReservationStatus,
      createdAt: t.created_at,
    })),
    idempotentReplay: p.idempotent_replay,
  };
}
