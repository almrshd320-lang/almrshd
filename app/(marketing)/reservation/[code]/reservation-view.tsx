'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PartyPopper, ArrowRight } from 'lucide-react';
import { getReservationByTokenAction } from '@/lib/reservations/actions';
import { QrCard } from '@/components/tracking/qr-card';
import { ReservationTimeline } from '@/components/tracking/reservation-timeline';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/site';
import type { CustomerReservation } from '@/types/domain';

/**
 * Confirmation page.
 *
 * The access token arrives in the URL *fragment* (`#t=…`), which is why this is
 * a client component: fragments are never sent to the server, so the token
 * stays out of request lines, server logs, referrer headers and browser history
 * sync. It is read once, exchanged for the reservation, and then stripped from
 * the visible address bar.
 */
export function ReservationView({ code }: { code: string }) {
  const [reservation, setReservation] = useState<CustomerReservation | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const raw = params.get('t');

    if (!raw) {
      setError('رابط غير مكتمل. استخدم صفحة التتبع للوصول إلى حجزك.');
      setLoading(false);
      return;
    }

    setToken(raw);

    let cancelled = false;
    void (async () => {
      const result = await getReservationByTokenAction(code, raw);
      if (cancelled) return;

      if (result.ok) setReservation(result.data);
      else setError(result.error);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) return <LoadingState label="جارٍ تحميل حجزك…" />;

  if (error || !reservation) {
    return (
      <ErrorState
        title="تعذّر عرض الحجز"
        description={error ?? 'رابط غير صالح.'}
        action={
          <Link href={routes.track}>
            <Button variant="secondary">الذهاب إلى صفحة التتبع</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      <header className="text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-[#3FBE86]/25 bg-[#3FBE86]/10">
          <PartyPopper className="size-6 text-[#3FBE86]" aria-hidden="true" />
        </span>

        <h1 className="text-display-md font-semibold text-balance text-ink-50">
          تم إنشاء حجزك بنجاح
        </h1>
        <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-ink-400">
          احتفظ برقم الحجز ورمز QR. سنتواصل معك على رقم هاتفك لتأكيد الحجز.
        </p>
      </header>

      <QrCard reservation={reservation} accessToken={token} />

      <section aria-labelledby="timeline-title" className="surface p-6">
        <h2 id="timeline-title" className="mb-6 text-base font-semibold text-ink-50">
          مراحل الحجز
        </h2>
        <ReservationTimeline
          status={reservation.status}
          deliveryMethod={reservation.deliveryMethod}
          entries={reservation.timeline}
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={routes.track} className="sm:flex-1">
          <Button variant="secondary" size="lg" fullWidth>
            تتبع الحجز لاحقًا
          </Button>
        </Link>
        <Link href={routes.home} className="sm:flex-1">
          <Button variant="ghost" size="lg" fullWidth>
            العودة للرئيسية
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>

      <p className="text-center text-xs leading-relaxed text-ink-500">
        احفظ هذه الصفحة في المفضلة للرجوع إليها، أو استخدم رقم الحجز ورقم هاتفك في
        صفحة التتبع.
      </p>
    </div>
  );
}
