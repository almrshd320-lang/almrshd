import type { Metadata } from 'next';
import { getPublicSettings, getBookingWindow } from '@/lib/settings';
import { getBookableVariants, getAllVariants, getProducts, getSpecs } from '@/lib/catalog';
import { Hero } from '@/components/hero/hero';
import { ProductShowcase, FeatureGrid } from '@/components/product/showcase';
import { ColorSelector } from '@/components/product/color-selector';
import { ViewerSection } from '@/components/3d/viewer-section';
import { Comparison } from '@/components/product/comparison';
import { AvailabilityGrid } from '@/components/product/availability-grid';
import { HowItWorks, TrustSection } from '@/components/sections/how-it-works';
import { Faq, FinalCta } from '@/components/sections/faq';
import { site, siteUrl } from '@/config/site';
import type { SelectableColor } from '@/stores/selection-store';
import type { PublicSpec } from '@/types/domain';

/**
 * Landing page — a Server Component.
 *
 * All data is fetched here, in parallel, and passed down. The client islands
 * (hero motion, colour selector, comparison tabs, 3D viewer) receive plain
 * props; none of them fetches anything, so there is no waterfall and no
 * loading spinner on first paint.
 *
 * Availability is revalidated every 60s: fresh enough that a sold-out colour
 * stops showing as available within a minute, cheap enough to survive a launch.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function LandingPage() {
  const [settings, bookingWindow, bookableVariants, allVariants, products, specs] =
    await Promise.all([
      getPublicSettings(),
      getBookingWindow(),
      getBookableVariants(),
      getAllVariants(),
      getProducts(),
      getSpecs(),
    ]);

  // The headline product: whichever slug the admin nominated, else the first
  // bookable one. No slug is hard-coded in this file.
  const primaryProduct =
    products.find((p) => p.slug === settings.primaryProductSlug) ??
    products.find((p) => p.isBookable) ??
    products[0] ??
    null;

  // Distinct colours available for the primary product.
  const colorMap = new Map<string, SelectableColor>();
  for (const variant of bookableVariants) {
    if (primaryProduct && variant.productId !== primaryProduct.id) continue;
    if (colorMap.has(variant.colorKey)) continue;
    colorMap.set(variant.colorKey, {
      id: variant.colorId,
      key: variant.colorKey,
      nameAr: variant.colorNameAr,
      hex: variant.colorHex,
      gradientFrom: variant.gradientFrom,
      gradientTo: variant.gradientTo,
      imagePath: variant.colorImagePath,
    });
  }
  const colors = [...colorMap.values()];

  const specsByProduct: Record<string, PublicSpec[]> = {};
  for (const spec of specs) {
    (specsByProduct[spec.productId] ??= []).push(spec);
  }

  // The two products compared, in the order the setting lists them.
  const compareProducts = settings.compareProductSlugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const primarySpecs = primaryProduct ? (specsByProduct[primaryProduct.id] ?? []) : [];

  const availabilityVariants = primaryProduct
    ? bookableVariants.filter((v) => v.productId === primaryProduct.id)
    : bookableVariants;

  return (
    <>
      <Hero
        product={primaryProduct}
        bookingWindow={bookingWindow}
        maintenanceMessage={settings.maintenanceMessageAr}
      />

      <ProductShowcase product={primaryProduct} specs={primarySpecs} />

      <ColorSelector
        colors={colors}
        productName={primaryProduct?.nameAr ?? ''}
        heroImagePath={primaryProduct?.heroImagePath ?? null}
      />

      <ViewerSection modelPath={primaryProduct?.model3dPath ?? null} />

      <FeatureGrid specs={primarySpecs} productName={primaryProduct?.nameAr ?? 'الجهاز'} />

      <Comparison products={compareProducts} specsByProduct={specsByProduct} />

      <AvailabilityGrid variants={availabilityVariants} bookingOpen={bookingWindow.isOpen} />

      <HowItWorks bookingOpen={bookingWindow.isOpen} />

      <TrustSection settings={settings} />

      <Faq settings={settings} expiryHours={settings.reservationExpiryHours} />

      <FinalCta bookingOpen={bookingWindow.isOpen} storeName={settings.storeName} />

      {/* Organisation structured data. Uses only values the store has actually
          configured — no invented address, rating or price range. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: settings.storeName,
            alternateName: settings.storeNameEn,
            url: siteUrl,
            description: site.description,
            ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
            ...(allVariants.length > 0
              ? { areaServed: { '@type': 'Country', name: 'Libya' } }
              : {}),
          }),
        }}
      />
    </>
  );
}
