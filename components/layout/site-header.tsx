'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { landingSections, routes } from '@/config/site';
import { Button } from '@/components/ui/button';

/**
 * Site header.
 *
 * Transparent over the hero, then a solid hairline surface once the page moves.
 * The mobile menu is a full-height sheet — on a phone, a cramped dropdown in
 * the top corner is the wrong shape for a thumb.
 */

export function SiteHeader({
  storeName,
  announcement,
  bookingOpen,
}: {
  storeName: string;
  announcement?: string;
  bookingOpen: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock the page behind the open sheet.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      {announcement && (
        <div className="relative z-50 bg-burgundy-700 px-4 py-2 text-center text-xs font-medium text-burgundy-50">
          {announcement}
        </div>
      )}

      <header
        className={cn(
          'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
          scrolled
            ? 'border-b border-white/8 bg-ink-900/80 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="shell flex h-16 items-center justify-between gap-4">
          <Link
            href={routes.home}
            className="flex items-center gap-2.5"
            aria-label={`${storeName} — الصفحة الرئيسية`}
          >
            <Wordmark />
            <span className="text-base font-semibold tracking-tight text-ink-50">
              {storeName}
            </span>
          </Link>

          <nav aria-label="التنقل الرئيسي" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {landingSections.slice(2, 8).map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={routes.track}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50 sm:inline-flex"
            >
              <Search className="size-4" aria-hidden="true" />
              تتبع حجزك
            </Link>

            {bookingOpen && (
              <Link href={routes.book} className="hidden sm:block">
                <Button size="sm">احجز الآن</Button>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid size-11 place-items-center rounded-lg text-ink-100 transition-colors hover:bg-white/[0.06] lg:hidden"
              aria-label="فتح القائمة"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="fixed inset-0 z-50 bg-ink-900 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="القائمة"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <span className="text-base font-semibold text-ink-50">{storeName}</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="grid size-11 place-items-center rounded-lg text-ink-100 hover:bg-white/[0.06]"
            aria-label="إغلاق القائمة"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="التنقل" className="px-5 pb-8">
          <ul className="space-y-1">
            {landingSections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-4 py-3.5 text-base text-ink-100 transition-colors hover:bg-white/[0.06]"
                >
                  {section.label}
                </a>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href={routes.track}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-4 py-3.5 text-base text-ink-100 transition-colors hover:bg-white/[0.06]"
              >
                تتبع حجزك
              </Link>
            </li>
          </ul>

          {bookingOpen && (
            <Link href={routes.book} onClick={() => setMenuOpen(false)} className="mt-6 block">
              <Button size="lg" fullWidth>
                احجز الآن
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}

/**
 * Al-Murshid mark — an original geometric compass rose (المرشد = "the guide").
 * Deliberately nothing like any existing technology brand's identity.
 */
function Wordmark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-8"
      role="img"
      aria-label="شعار المرشد"
      fill="none"
    >
      <circle cx="16" cy="16" r="14.5" stroke="url(#am-ring)" strokeWidth="1.25" />
      <path d="M16 5.5 19 16l-3 10.5L13 16Z" fill="url(#am-needle)" />
      <path d="M5.5 16 16 13l10.5 3L16 19Z" fill="currentColor" opacity="0.28" />
      <circle cx="16" cy="16" r="1.75" fill="#fff" />
      <defs>
        <linearGradient id="am-ring" x1="16" y1="1" x2="16" y2="31">
          <stop stopColor="#C9CCD1" stopOpacity="0.9" />
          <stop offset="1" stopColor="#C9CCD1" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="am-needle" x1="16" y1="5.5" x2="16" y2="26.5">
          <stop stopColor="#B85C74" />
          <stop offset="1" stopColor="#6B1F2E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
