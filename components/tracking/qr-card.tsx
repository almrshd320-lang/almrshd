'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Copy, Check, Printer, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildQrPayload } from '@/lib/validation/schemas';
import { formatDateTime, cn } from '@/lib/utils';
import type { CustomerReservation } from '@/types/domain';

/**
 * Reservation card: code, QR, and what the customer needs at the counter.
 *
 * The QR payload is `MRSH1:<code>:<token>` and nothing else. No name, no phone,
 * no city, no address — and no price, because a price never reaches this
 * component in the first place. Anyone who photographs this screen over the
 * customer's shoulder learns which device was reserved and nothing about who
 * reserved it.
 */

interface QrCardProps {
  reservation: CustomerReservation;
  accessToken: string | null;
  className?: string;
}

export function QrCard({ reservation, accessToken, className }: QrCardProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(reservation.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable outside a secure context; the code is on
      // screen and selectable anyway.
    }
  };

  const canShowQr =
    Boolean(accessToken) &&
    !['CANCELLED', 'EXPIRED', 'DELIVERED'].includes(reservation.status);

  return (
    <div className={cn('surface overflow-hidden print:border print:bg-white', className)}>
      <div className="border-b border-white/8 p-6 text-center print:border-ink-200">
        <p className="text-sm text-ink-400 print:text-ink-500">رقم الحجز</p>

        <p className="ltr-nums mt-2 font-mono text-3xl font-semibold tracking-wider text-ink-50 print:text-ink-900 sm:text-4xl">
          {reservation.code}
        </p>

        <div className="mt-4 flex justify-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={copyCode}>
            {copied ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                تم النسخ
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                نسخ الرقم
              </>
            )}
          </Button>

          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" aria-hidden="true" />
            طباعة
          </Button>
        </div>
      </div>

      {canShowQr && accessToken && (
        <div className="flex flex-col items-center gap-4 border-b border-white/8 p-6 print:border-ink-200">
          {/* White quiet zone: a QR on a dark surface fails to scan on many
              phone cameras, so the code always gets its own light plate. */}
          <div className="rounded-2xl bg-white p-4">
            <QRCode
              value={buildQrPayload(reservation.code, accessToken)}
              size={168}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#0B0C0D"
            />
          </div>

          <p className="max-w-xs text-center text-xs leading-relaxed text-ink-400 print:text-ink-500">
            اعرض هذا الرمز عند الاستلام. الرمز يُستخدم مرة واحدة فقط ولا يحتوي على
            بياناتك الشخصية.
          </p>
        </div>
      )}

      <dl className="divide-y divide-white/8 print:divide-ink-200">
        <Row label="الجهاز" value={reservation.product.nameAr} />
        <Row label="السعة" value={reservation.capacity.labelAr} />
        <Row
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
        <Row
          label="طريقة الاستلام"
          value={reservation.deliveryMethod === 'PICKUP' ? 'استلام من الفرع' : 'توصيل'}
        />

        {reservation.branch ? (
          <div className="p-4">
            <dt className="mb-2 text-sm text-ink-400 print:text-ink-500">الفرع</dt>
            <dd className="space-y-1.5">
              <p className="text-sm font-medium text-ink-50 print:text-ink-900">
                {reservation.branch.nameAr}
              </p>
              {reservation.branch.addressAr && (
                <p className="flex items-start gap-1.5 text-xs text-ink-400">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {reservation.branch.addressAr}
                </p>
              )}
              {reservation.branch.phone && (
                <p className="flex items-center gap-1.5 text-xs text-ink-400">
                  <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                  <bdi className="ltr-nums">{reservation.branch.phone}</bdi>
                </p>
              )}
              {reservation.branch.mapsUrl && (
                <a
                  href={reservation.branch.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-burgundy-300 underline print:hidden"
                >
                  عرض الموقع على الخريطة
                </a>
              )}
            </dd>
          </div>
        ) : (
          reservation.deliveryCity && <Row label="مدينة التوصيل" value={reservation.deliveryCity} />
        )}

        <Row label="تاريخ الحجز" value={formatDateTime(reservation.createdAt)} />

        {!['DELIVERED', 'CANCELLED', 'EXPIRED'].includes(reservation.status) && (
          <Row label="صالح حتى" value={formatDateTime(reservation.expiresAt)} />
        )}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <dt className="text-sm text-ink-400 print:text-ink-500">{label}</dt>
      <dd className="text-sm font-medium text-ink-50 print:text-ink-900">{value}</dd>
    </div>
  );
}
