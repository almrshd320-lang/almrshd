/**
 * Static site metadata. Anything an admin should be able to change at runtime
 * lives in app_settings instead — this file holds only what is fixed at build
 * time (routes, SEO defaults, the canonical origin).
 */

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://almurshid.ly';

export const site = {
  name: 'المرشد',
  nameEn: 'Al-Murshid',
  locale: 'ar_LY',
  lang: 'ar',
  dir: 'rtl',

  /** SEO defaults. Overridden per page where a page has its own metadata. */
  title: 'المرشد — احجز آيفون الجيل الجديد',
  titleTemplate: '%s · المرشد',
  description:
    'منصة الحجز المسبق من المرشد لأحدث أجهزة آيفون برو. اختر الطراز والسعة واللون، '
    + 'واحجز جهازك للاستلام من الفرع أو التوصيل إلى مدينتك.',

  keywords: [
    'المرشد', 'آيفون', 'حجز مسبق', 'ليبيا', 'طرابلس', 'بنغازي',
    'iPhone', 'Al-Murshid', 'pre-order', 'Libya',
  ],

  ogImage: '/images/og.png',
} as const;

export const routes = {
  home: '/',
  book: '/book',
  track: '/track',
  reservation: (code: string) => `/reservation/${code}`,
  faq: '/#faq',
  admin: {
    root: '/admin',
    login: '/admin/login',
    reservations: '/admin/reservations',
    reservation: (id: string) => `/admin/reservations/${id}`,
    pricing: '/admin/pricing',
    stock: '/admin/stock',
    scan: '/admin/scan',
    audit: '/admin/audit',
    settings: '/admin/settings',
  },
} as const;

/**
 * Landing page sections, in order. The nav and the scroll-spy read from here so
 * reordering a section is a one-line change.
 */
export const landingSections = [
  { id: 'hero', label: 'الرئيسية' },
  { id: 'countdown', label: 'العد التنازلي' },
  { id: 'showcase', label: 'الجهاز' },
  { id: 'colors', label: 'الألوان' },
  { id: 'viewer', label: 'عرض 360°' },
  { id: 'features', label: 'المميزات' },
  { id: 'compare', label: 'المقارنة' },
  { id: 'availability', label: 'التوفر' },
  { id: 'how', label: 'كيف يعمل الحجز' },
  { id: 'faq', label: 'الأسئلة الشائعة' },
] as const;
