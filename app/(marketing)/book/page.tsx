import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getPublicSettings, getBookingWindow } from '@/lib/settings';
import { getBookableVariants, getBranches, buildCatalogTree } from '@/lib/catalog';
import { BookingWizard } from '@/components/booking/booking-wizard';
import { routes } from '@/config/site';

/**
 * Booking page.
 *
 * The catalog is fetched on the server and handed to the wizard as a plain tree,
 * so the client never queries Supabase directly and there is no loading state
 * between steps. Availability is deliberately not cached: a customer starting a
 * booking should see stock as of now, not as of a minute ago.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'احجز جهازك',
  description: 'احجز جهاز آيفون الجديد من المرشد: اختر الطراز والسعة واللون وطريقة الاستلام.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/book' },
};

export default async function BookPage() {
  const [settings, bookingWindow, variants, branches] = await Promise.all([
    getPublicSettings(),
    getBookingWindow(),
    getBookableVariants(),
    getBranches(),
  ]);

  const tree = buildCatalogTree(variants);

  return (
    <div className="shell py-10 sm:py-16">
      <Link
        href={routes.home}
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
        العودة للرئيسية
      </Link>

      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1 className="text-display-md font-semibold text-balance text-ink-50">
            احجز جهازك
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            ست خطوات قصيرة. لن نطلب منك أي بيانات غير ضرورية.
          </p>
        </header>

        <BookingWizard
          tree={tree}
          branches={branches}
          settings={settings}
          bookingWindow={bookingWindow}
        />
      </div>
    </div>
  );
}
