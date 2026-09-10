'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search } from 'lucide-react';
import { trackReservationAction } from '@/lib/reservations/actions';
import { ReservationTimeline } from '@/components/tracking/reservation-timeline';
import { StatusBadge } from '@/components/ui/indicators';
import { InlineError } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { formatDateTime } from '@/lib/utils';
import type { CustomerReservation } from '@/types/domain';

/**
 * Reservation lookup.
 *
 * Two factors are required — the code AND the phone number used to book — and
 * the server returns the same message for "no such code" and "wrong phone", so
 * this form cannot be used to discover which codes exist. It is also rate
 * limited per IP.
 */

const formSchema = z.object({
  code: z.string().trim().min(1, 'رقم الحجز مطلوب'),
  phone: z.string().trim().min(1, 'رقم الهاتف مطلوب'),
});

type FormValues = z.infer<typeof formSchema>;

export function TrackForm() {
  const [isPending, startTransition] = useTransition();
  const [reservation, setReservation] = useState<CustomerReservation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '', phone: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    setReservation(null);

    startTransition(async () => {
      const result = await trackReservationAction(values);
      if (result.ok) setReservation(result.data);
      else setError(result.error);
    });
  });

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} noValidate className="surface space-y-5 p-6">
        <Input
          label="رقم الحجز"
          required
          ltr
          placeholder="MRSH-8K4P2X"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          error={errors.code?.message}
          {...register('code')}
        />

        <Input
          label="رقم الهاتف"
          required
          type="tel"
          inputMode="tel"
          ltr
          placeholder="0912345678"
          autoComplete="tel"
          hint="نفس الرقم الذي استخدمته عند الحجز."
          error={errors.phone?.message}
          {...register('phone')}
        />

        {error && <InlineError message={error} />}

        <Button type="submit" size="lg" fullWidth loading={isPending} loadingLabel="جارٍ البحث…">
          <Search className="size-4" aria-hidden="true" />
          عرض حالة الحجز
        </Button>
      </form>

      {reservation && (
        <section
          aria-live="polite"
          aria-labelledby="result-title"
          className="space-y-6"
        >
          <div className="surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="result-title" className="text-sm text-ink-400">
                  رقم الحجز
                </h2>
                <p className="ltr-nums mt-1 font-mono text-xl font-semibold text-ink-50">
                  {reservation.code}
                </p>
              </div>
              <StatusBadge status={reservation.status} />
            </div>

            <dl className="mt-6 grid gap-4 border-t border-white/8 pt-5 sm:grid-cols-2">
              <Detail label="الجهاز" value={reservation.product.nameAr} />
              <Detail label="السعة" value={reservation.capacity.labelAr} />
              <Detail
                label="اللون"
                value={
                  <span className="flex items-center gap-2">
                    <span
                      className="size-4 rounded-full"
                      style={{
                        backgroundColor: reservation.color.hex,
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
                      }}
                      aria-hidden="true"
                    />
                    {reservation.color.nameAr}
                  </span>
                }
              />
              <Detail
                label="طريقة الاستلام"
                value={reservation.deliveryMethod === 'PICKUP' ? 'استلام من الفرع' : 'توصيل'}
              />
              {reservation.branch && <Detail label="الفرع" value={reservation.branch.nameAr} />}
              {reservation.deliveryCity && (
                <Detail label="مدينة التوصيل" value={reservation.deliveryCity} />
              )}
              <Detail label="تاريخ الحجز" value={formatDateTime(reservation.createdAt)} />
              <Detail label="صاحب الحجز" value={reservation.customerNameMasked} />
            </dl>
          </div>

          <div className="surface p-6">
            <h3 className="mb-6 text-base font-semibold text-ink-50">مراحل الحجز</h3>
            <ReservationTimeline
              status={reservation.status}
              deliveryMethod={reservation.deliveryMethod}
              entries={reservation.timeline}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink-50">{value}</dd>
    </div>
  );
}
