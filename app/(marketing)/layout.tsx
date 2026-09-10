import { getPublicSettings, getBookingWindow } from '@/lib/settings';
import { getBranches } from '@/lib/catalog';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

/**
 * Storefront shell. Header and footer are rendered once here and read their
 * content from app_settings, so a store name or announcement change takes
 * effect everywhere at once.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, bookingWindow, branches] = await Promise.all([
    getPublicSettings(),
    getBookingWindow(),
    getBranches(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        storeName={settings.storeName}
        announcement={settings.announcementAr || undefined}
        bookingOpen={bookingWindow.isOpen}
      />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter settings={settings} branches={branches} />
    </div>
  );
}
