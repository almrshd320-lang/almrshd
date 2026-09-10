import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { site, siteUrl } from '@/config/site';
import './globals.css';

/**
 * Root layout. Arabic-first and RTL at the document level, so every child
 * inherits the correct direction rather than opting in.
 */

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
  // Reserves the right metrics before the webfont lands, so the hero headline
  // does not jump on load.
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: site.title, template: site.titleTemplate },
  description: site.description,
  keywords: [...site.keywords],
  applicationName: site.nameEn,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: siteUrl,
    siteName: site.name,
    title: site.title,
    description: site.description,
    images: [{ url: site.ogImage, width: 1200, height: 630, alt: site.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
    images: [site.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom must stay available; capping it is an accessibility failure.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0C0D' },
    { media: '(prefers-color-scheme: light)', color: '#0B0C0D' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.lang} dir={site.dir} className={arabic.variable}>
      <body className="min-h-dvh bg-ink-900 font-sans antialiased">
        <a
          href="#main"
          className="sr-only-focusable fixed right-4 top-4 z-[100] rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink-900"
        >
          تخطَّ إلى المحتوى الرئيسي
        </a>
        {children}
      </body>
    </html>
  );
}
