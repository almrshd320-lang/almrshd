import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/site';
import type { PublicSettings } from '@/types/domain';

/**
 * FAQ and the final call to action.
 *
 * Native <details>/<summary>: keyboard accessible, announced correctly, works
 * with JavaScript disabled, and needs no state. An accordion built from divs
 * and onClick would be strictly worse in every one of those respects.
 *
 * Every answer describes only mechanics the platform actually implements. There
 * is no invented delivery window, warranty or payment term anywhere here.
 */

export function Faq({ settings, expiryHours }: { settings: PublicSettings; expiryHours: number }) {
  const items: { q: string; a: string }[] = [
    {
      q: 'هل الحجز يعني شراء الجهاز؟',
      a: 'لا. الحجز يثبّت لك جهازًا من الكمية المتاحة، ويصبح نهائيًا بعد تأكيدنا له وتواصلنا معك.',
    },
    {
      q: 'كم تستمر صلاحية الحجز؟',
      a: `صلاحية الحجز ${expiryHours} ساعة. إذا لم يُؤكَّد خلالها تنتهي صلاحيته تلقائيًا وتعود الكمية للمتاح.`,
    },
    {
      q: 'كيف أتابع حالة حجزي؟',
      a: 'من صفحة «تتبع حجزك»، أدخل رقم الحجز ورقم هاتفك لعرض الحالة الحالية ومراحل الحجز.',
    },
    {
      q: 'ماذا لو فقدت رقم الحجز؟',
      a: 'تواصل معنا مع رقم الهاتف الذي استخدمته في الحجز، وسنساعدك في الوصول إلى حجزك.',
    },
    {
      q: 'ما فائدة رمز QR؟',
      a: 'رمز QR هو إثبات حجزك عند الاستلام. يُقرأ من قِبل موظفينا مرة واحدة فقط، ولا يحتوي على أي من بياناتك الشخصية.',
    },
    {
      q: 'هل يمكنني تعديل اختياري بعد الحجز؟',
      a: 'يمكنك التواصل معنا لمناقشة التعديل. التعديل يعتمد على توفر الخيار الجديد.',
    },
    {
      q: 'لماذا لا تظهر الأسعار على الموقع؟',
      a: 'نفضّل مناقشة السعر معك مباشرة عند تأكيد الحجز، لضمان أن تصلك المعلومة الصحيحة والمحدثة.',
    },
    {
      q: 'ماذا يعني «كمية محدودة»؟',
      a: 'يعني أن المتبقي من هذا الخيار قليل. ننصح بإتمام الحجز مبكرًا إذا كان هو اختيارك.',
    },
  ];

  if (settings.contactPhone || settings.whatsappNumber) {
    items.push({
      q: 'كيف أتواصل معكم؟',
      a: `يمكنك التواصل معنا${settings.contactPhone ? ` على الرقم ${settings.contactPhone}` : ''}${
        settings.whatsappNumber ? ' أو عبر واتساب' : ''
      }.`,
    });
  }

  return (
    <>
      <section id="faq" className="scroll-mt-20 py-section" aria-labelledby="faq-title">
        <div className="shell">
          <header className="mb-12 max-w-prose">
            <p className="mb-3 text-sm font-medium text-burgundy-400">الأسئلة الشائعة</p>
            <h2 id="faq-title" className="text-display-md font-semibold text-balance text-ink-50">
              أسئلة يطرحها الجميع
            </h2>
          </header>

          <div className="mx-auto max-w-3xl divide-y divide-white/8 border-y border-white/8">
            {items.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-start">
                  <h3 className="text-base font-medium text-ink-100 group-hover:text-ink-50">
                    {item.q}
                  </h3>
                  <ChevronDown
                    className="size-4 shrink-0 text-ink-500 transition-transform duration-300 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-ink-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Structured data helps the FAQ surface in search results. Built from the
          same array, so it can never drift from what the page shows. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
    </>
  );
}

export function FinalCta({
  bookingOpen,
  storeName,
}: {
  bookingOpen: boolean;
  storeName: string;
}) {
  return (
    <section className="relative overflow-hidden py-section" aria-labelledby="cta-title">
      <div className="product-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="shell relative text-center">
        <h2
          id="cta-title"
          className="mx-auto max-w-2xl text-display-lg font-semibold text-balance text-ink-50"
        >
          جهازك بانتظارك في {storeName}
        </h2>
        <p className="mx-auto mt-5 max-w-prose text-base leading-relaxed text-ink-300">
          احجز الآن واختر ما يناسبك، وتابع حجزك خطوة بخطوة حتى الاستلام.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          {bookingOpen ? (
            <Link href={routes.book}>
              <Button size="lg" fullWidth className="sm:w-auto">
                احجز الآن
              </Button>
            </Link>
          ) : (
            <Button size="lg" disabled className="sm:w-auto">
              الحجز غير متاح حاليًا
            </Button>
          )}

          <Link href={routes.track}>
            <Button size="lg" variant="secondary" fullWidth className="sm:w-auto">
              تتبع حجزك
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
