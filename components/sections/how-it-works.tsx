import Link from 'next/link';
import { MousePointerClick, ClipboardCheck, QrCode, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/site';
import type { PublicSettings } from '@/types/domain';

/**
 * "How pre-ordering works" and the trust section.
 *
 * These describe only what the platform actually does. Delivery times, warranty
 * terms, payment requirements and availability guarantees are NOT stated here,
 * because Al-Murshid has not defined them — and inventing them would be the
 * kind of small fiction that costs a store its credibility on day one. Each
 * note renders only once its setting is filled in.
 */

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'اختر جهازك',
    body: 'حدّد الطراز والسعة واللون وطريقة الاستلام في خطوات قصيرة.',
  },
  {
    icon: ClipboardCheck,
    title: 'أكّد بياناتك',
    body: 'راجع اختيارك وأدخل اسمك ورقم هاتفك، ثم أكّد الحجز.',
  },
  {
    icon: QrCode,
    title: 'استلم رقم الحجز',
    body: 'يصلك رقم حجز ورمز QR خاص بك. احتفظ بهما — بهما تُستلم الجهاز.',
  },
  {
    icon: PackageCheck,
    title: 'تابع حتى الاستلام',
    body: 'تابع حالة حجزك في أي وقت عبر صفحة التتبع حتى تسلّم الجهاز.',
  },
];

export function HowItWorks({ bookingOpen }: { bookingOpen: boolean }) {
  return (
    <section id="how" className="scroll-mt-20 py-section" aria-labelledby="how-title">
      <div className="shell">
        <header className="mb-12 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">كيف يعمل الحجز</p>
          <h2 id="how-title" className="text-display-md font-semibold text-balance text-ink-50">
            أربع خطوات، ودقيقة واحدة
          </h2>
        </header>

        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="surface relative p-6">
              <span
                className="absolute left-5 top-5 font-mono text-4xl font-semibold text-white/[0.06]"
                aria-hidden="true"
              >
                {index + 1}
              </span>

              <span className="mb-4 grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                <step.icon className="size-4.5 text-burgundy-300" aria-hidden="true" />
              </span>

              <h3 className="mb-2 text-base font-semibold text-ink-50">{step.title}</h3>
              <p className="text-sm leading-relaxed text-ink-400">{step.body}</p>
            </li>
          ))}
        </ol>

        {bookingOpen && (
          <div className="mt-10">
            <Link href={routes.book}>
              <Button size="lg">ابدأ الحجز</Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export function TrustSection({ settings }: { settings: PublicSettings }) {
  const notes = [
    { title: 'ما معنى الحجز المسبق؟',
      body: 'الحجز المسبق يعني تثبيت جهاز باسمك من الكمية المتاحة. الحجز لا يكتمل إلا بعد تأكيدنا له.' },
    { title: 'الاستلام من الفرع', body: settings.trustPickupNoteAr },
    { title: 'التوصيل', body: settings.trustDeliveryNoteAr },
    { title: 'الدفع', body: settings.trustPaymentNoteAr },
  ].filter((note) => Boolean(note.body));

  if (notes.length === 0) return null;

  return (
    <section className="py-section" aria-labelledby="trust-title">
      <div className="shell">
        <header className="mb-10 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">الشفافية</p>
          <h2 id="trust-title" className="text-display-sm font-semibold text-ink-50">
            ما الذي يحدث بعد الحجز؟
          </h2>
        </header>

        <dl className="grid gap-6 sm:grid-cols-2">
          {notes.map((note) => (
            <div key={note.title} className="border-t border-white/8 pt-5">
              <dt className="mb-2 text-sm font-semibold text-ink-100">{note.title}</dt>
              <dd className="text-sm leading-relaxed text-ink-400">{note.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
