import type { Metadata } from 'next';

/**
 * Admin root. Switches the whole subtree to the light, dense, functional
 * surface — the storefront's cinematic treatment would actively get in the way
 * of a table of 400 reservations.
 *
 * Indexing is refused three ways: here, in the X-Robots-Tag header
 * (next.config.mjs) and in robots.txt.
 */
export const metadata: Metadata = {
  title: { default: 'لوحة الإدارة', template: '%s · لوحة الإدارة' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root min-h-dvh">{children}</div>;
}
