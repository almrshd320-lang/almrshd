import 'server-only';

import { cache } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import type {
  PublicVariant,
  PublicProduct,
  PublicSpec,
  PublicBranch,
  Availability,
} from '@/types/domain';

/**
 * Catalog reads.
 *
 * Every query here hits a v_public_* view, using the anonymous key. There is no
 * code path in this file that can reach variant_pricing or devices_stock — not
 * by policy, but because the view is the only object the role can name.
 */

// ─── Variants ────────────────────────────────────────────────────────────────

interface VariantRow {
  variant_id: string;
  product_id: string;
  product_slug: string;
  product_name_ar: string;
  is_bookable: boolean;
  capacity_id: string;
  capacity_key: string;
  capacity_label_ar: string;
  size_gb: number;
  color_id: string;
  color_key: string;
  color_name_ar: string;
  color_hex: string;
  gradient_from: string | null;
  gradient_to: string | null;
  color_image_path: string | null;
  display_order: number;
  availability: string;
  exact_quantity: number | null;
}

function toVariant(row: VariantRow): PublicVariant {
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    productSlug: row.product_slug,
    productNameAr: row.product_name_ar,
    isBookable: row.is_bookable,
    capacityId: row.capacity_id,
    capacityKey: row.capacity_key,
    capacityLabelAr: row.capacity_label_ar,
    sizeGb: row.size_gb,
    colorId: row.color_id,
    colorKey: row.color_key,
    colorNameAr: row.color_name_ar,
    colorHex: row.color_hex,
    gradientFrom: row.gradient_from,
    gradientTo: row.gradient_to,
    colorImagePath: row.color_image_path,
    displayOrder: row.display_order,
    availability: row.availability as Availability,
    exactQuantity: row.exact_quantity,
  };
}

export const getBookableVariants = cache(async (): Promise<PublicVariant[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('v_public_variants')
    .select('*')
    .eq('is_bookable', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[catalog] variants read failed', error.message);
    return [];
  }
  return (data as VariantRow[]).map(toVariant);
});

export const getAllVariants = cache(async (): Promise<PublicVariant[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('v_public_variants')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[catalog] variants read failed', error.message);
    return [];
  }
  return (data as VariantRow[]).map(toVariant);
});

// ─── Products ────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  tagline_ar: string | null;
  description_ar: string | null;
  generation: number | null;
  is_bookable: boolean;
  is_placeholder: boolean;
  hero_image_path: string | null;
  model_3d_path: string | null;
  display_order: number;
}

export const getProducts = cache(async (): Promise<PublicProduct[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('v_public_products')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[catalog] products read failed', error.message);
    return [];
  }

  return (data as ProductRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    taglineAr: row.tagline_ar,
    descriptionAr: row.description_ar,
    generation: row.generation,
    isBookable: row.is_bookable,
    isPlaceholder: row.is_placeholder,
    heroImagePath: row.hero_image_path,
    model3dPath: row.model_3d_path,
    displayOrder: row.display_order,
  }));
});

// ─── Specifications ──────────────────────────────────────────────────────────

interface SpecRow {
  id: string;
  product_id: string;
  group_key: string;
  key: string;
  label_ar: string;
  value_ar: string | null;
  value_numeric: number | null;
  unit_ar: string | null;
  icon: string | null;
  is_confirmed: boolean;
  is_highlight: boolean;
  display_order: number;
}

/**
 * Specs come back with `isConfirmed`. Unconfirmed rows carry a null value —
 * the view withholds it — so a component literally cannot render a speculative
 * figure as though it were announced.
 */
export const getSpecs = cache(async (): Promise<PublicSpec[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('v_public_specs')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[catalog] specs read failed', error.message);
    return [];
  }

  return (data as SpecRow[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    groupKey: row.group_key,
    key: row.key,
    labelAr: row.label_ar,
    valueAr: row.value_ar,
    valueNumeric: row.value_numeric,
    unitAr: row.unit_ar,
    icon: row.icon,
    isConfirmed: row.is_confirmed,
    isHighlight: row.is_highlight,
    displayOrder: row.display_order,
  }));
});

// ─── Branches ────────────────────────────────────────────────────────────────

interface BranchRow {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  city_ar: string;
  address_ar: string | null;
  phone: string | null;
  maps_url: string | null;
  opening_hours: Record<string, string>;
  display_order: number;
}

export const getBranches = cache(async (): Promise<PublicBranch[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('v_public_branches')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[catalog] branches read failed', error.message);
    return [];
  }

  return (data as BranchRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    cityAr: row.city_ar,
    addressAr: row.address_ar,
    phone: row.phone,
    mapsUrl: row.maps_url,
    openingHours: row.opening_hours ?? {},
    displayOrder: row.display_order,
  }));
});

// ─── Derived shapes for the booking wizard ───────────────────────────────────

export interface CatalogTree {
  products: { id: string; slug: string; nameAr: string; taglineAr: string | null }[];
  /** productId → capacities that actually exist for that model. */
  capacitiesByProduct: Map<string, { id: string; key: string; labelAr: string; sizeGb: number }[]>;
  /** `${productId}:${capacityId}` → colours, with their availability. */
  colorsByProductCapacity: Map<
    string,
    {
      id: string;
      key: string;
      nameAr: string;
      hex: string;
      gradientFrom: string | null;
      gradientTo: string | null;
      variantId: string;
      availability: Availability;
    }[]
  >;
}

/**
 * Builds the wizard's option tree from the variant list.
 *
 * The point of doing this from data rather than a hard-coded matrix: adding a
 * model or dropping a colour is a database change, and the wizard follows.
 * Step 2 shows only capacities that exist for the chosen model, and step 3 only
 * colours that exist for that model AND capacity.
 */
export function buildCatalogTree(variants: PublicVariant[]): CatalogTree {
  const products = new Map<string, { id: string; slug: string; nameAr: string; taglineAr: string | null }>();
  const capacitiesByProduct = new Map<string, Map<string, { id: string; key: string; labelAr: string; sizeGb: number }>>();
  const colorsByProductCapacity: CatalogTree['colorsByProductCapacity'] = new Map();

  for (const v of variants) {
    if (!products.has(v.productId)) {
      products.set(v.productId, {
        id: v.productId,
        slug: v.productSlug,
        nameAr: v.productNameAr,
        taglineAr: null,
      });
    }

    let caps = capacitiesByProduct.get(v.productId);
    if (!caps) {
      caps = new Map();
      capacitiesByProduct.set(v.productId, caps);
    }
    if (!caps.has(v.capacityId)) {
      caps.set(v.capacityId, {
        id: v.capacityId,
        key: v.capacityKey,
        labelAr: v.capacityLabelAr,
        sizeGb: v.sizeGb,
      });
    }

    const key = `${v.productId}:${v.capacityId}`;
    const colors = colorsByProductCapacity.get(key) ?? [];
    colors.push({
      id: v.colorId,
      key: v.colorKey,
      nameAr: v.colorNameAr,
      hex: v.colorHex,
      gradientFrom: v.gradientFrom,
      gradientTo: v.gradientTo,
      variantId: v.variantId,
      availability: v.availability,
    });
    colorsByProductCapacity.set(key, colors);
  }

  return {
    products: [...products.values()],
    capacitiesByProduct: new Map(
      [...capacitiesByProduct.entries()].map(([pid, caps]) => [
        pid,
        [...caps.values()].sort((a, b) => a.sizeGb - b.sizeGb),
      ]),
    ),
    colorsByProductCapacity,
  };
}
