import Link from 'next/link';
import { Phone, MessageCircle, Instagram, Facebook, MapPin } from 'lucide-react';
import { routes } from '@/config/site';
import type { PublicSettings, PublicBranch } from '@/types/domain';

/**
 * Footer.
 *
 * Every block is conditional on configuration. If Al-Murshid has not supplied a
 * phone number or a social link yet, the block is omitted rather than rendered
 * empty or filled with a plausible-looking placeholder.
 */
export function SiteFooter({
  settings,
  branches,
}: {
  settings: PublicSettings;
  branches: PublicBranch[];
}) {
  const socials = [
    { href: settings.socialInstagram, Icon: Instagram, label: 'إنستغرام' },
    { href: settings.socialFacebook, Icon: Facebook, label: 'فيسبوك' },
  ].filter((s) => Boolean(s.href));

  const whatsappHref = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`
    : null;

  return (
    <footer className="border-t border-white/8 bg-ink-900">
      <div className="shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-ink-50">{settings.storeName}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-ink-400">
              منصة الحجز المسبق لأحدث أجهزة آيفون. اختر جهازك، احجزه، وتابع حالة
              حجزك حتى الاستلام.
            </p>

            {(settings.contactPhone || whatsappHref) && (
              <div className="flex flex-wrap gap-3 pt-2">
                {settings.contactPhone && (
                  <a
                    href={`tel:${settings.contactPhone}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-white/[0.06]"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    <bdi className="ltr-nums">{settings.contactPhone}</bdi>
                  </a>
                )}
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-white/[0.06]"
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    واتساب
                  </a>
                )}
              </div>
            )}
          </div>

          <nav aria-label="روابط">
            <h3 className="mb-4 text-sm font-semibold text-ink-100">روابط</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href={routes.home} className="text-ink-400 transition-colors hover:text-ink-100">
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link href={routes.track} className="text-ink-400 transition-colors hover:text-ink-100">
                  تتبع حجزك
                </Link>
              </li>
              <li>
                <a href={routes.faq} className="text-ink-400 transition-colors hover:text-ink-100">
                  الأسئلة الشائعة
                </a>
              </li>
              {settings.bookingEnabled && (
                <li>
                  <Link href={routes.book} className="text-ink-400 transition-colors hover:text-ink-100">
                    احجز الآن
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          {branches.length > 0 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-ink-100">الفروع</h3>
              <ul className="space-y-3 text-sm">
                {branches.map((branch) => (
                  <li key={branch.id} className="flex gap-2 text-ink-400">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden="true" />
                    <span>
                      <span className="block text-ink-200">{branch.nameAr}</span>
                      <span className="text-xs">{branch.cityAr}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-col-reverse items-center justify-between gap-4 border-t border-white/8 pt-6 sm:flex-row">
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} {settings.storeName}. جميع الحقوق محفوظة.
          </p>

          {socials.length > 0 && (
            <ul className="flex items-center gap-2">
              {socials.map(({ href, Icon, label }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid size-10 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-ink-100"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-center text-[0.6875rem] leading-relaxed text-ink-600">
          {settings.storeName} متجر مستقل. أسماء المنتجات والعلامات التجارية المذكورة
          تعود لأصحابها.
        </p>
      </div>
    </footer>
  );
}
