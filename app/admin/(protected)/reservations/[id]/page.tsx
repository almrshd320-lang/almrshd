import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, QrCode, Clock, Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guard';
import { getReservationDetail } from '@/lib/admin/queries';
import { AdminPage, AdminCard, PriceRedacted } from '@/components/admin/shell';
import { StatusBadge } from '@/components/ui/indicators';
import { StatusControl } from '@/components/admin/status-control';
import { RESERVATION_STATUS, DELIVERY_METHOD } from '@/config/statuses';
import { formatDateTime, formatCurrencyLyd } from '@/lib/utils';
import { formatLibyanPhone } from '@/lib/validation/schemas';
import { routes } from '@/config/site';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'تفاصيل الحجز' };

/**
 * Reservation detail.
 *
 * The internal price appears only when the signed-in user holds view_prices —
 * and that decision is made in SQL (admin_reservation_detail returns null
 * otherwise), not by a conditional in this file. A staff account cannot reveal
 * the price by editing the DOM, because the number was never sent.
 */
export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission('view_reservations');
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const reservation = await getReservationDetail(id);
  if (!reservation) notFound();

  return (
    <AdminPage
      title={reservation.code}
      description={`أُنشئ في ${formatDateTime(reservation.createdAt)}`}
      actions={<StatusBadge status={reservation.status} light />}
    >
      <Link
        href={routes.admin.reservations}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-700"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
        العودة للحجوزات
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <AdminCard title="بيانات العميل">
            <dl className="divide-y divide-ink-200">
              <Row label="الاسم" value={reservation.customerName} />
              <Row
                label="رقم الهاتف"
                value={
                  <a
                    href={`tel:${reservation.customerPhone}`}
                    className="ltr-nums text-burgundy-600 hover:underline"
                  >
                    <bdi>{formatLibyanPhone(reservation.customerPhone)}</bdi>
                  </a>
                }
              />
              <Row label="المدينة" value={reservation.customerCity} />
            </dl>
          </AdminCard>

          <AdminCard title="تفاصيل الطلب">
            <dl className="divide-y divide-ink-200">
              <Row label="الطراز" value={reservation.product.nameAr} />
              <Row label="السعة" value={reservation.capacity.labelAr} />
              <Row
                label="اللون"
                value={
                  <span className="flex items-center gap-2">
                    <span
                      className="size-4 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: reservation.color.hex }}
                      aria-hidden="true"
                    />
                    {reservation.color.nameAr}
                  </span>
                }
              />
              <Row
                label="طريقة الاستلام"
                value={DELIVERY_METHOD[reservation.deliveryMethod]?.ar ?? reservation.deliveryMethod}
              />
              <Row
                label={reservation.deliveryMethod === 'PICKUP' ? 'الفرع' : 'مدينة التوصيل'}
                value={reservation.branch?.nameAr ?? reservation.deliveryCity ?? '—'}
              />

              {/* The private figure. Null for anyone without view_prices. */}
              <Row
                label="السعر الداخلي وقت الحجز"
                value={
                  reservation.canViewPrice && reservation.priceAtReservation != null ? (
                    <span className="font-semibold text-ink-800">
                      {formatCurrencyLyd(reservation.priceAtReservation)}
                    </span>
                  ) : (
                    <PriceRedacted />
                  )
                }
                hint={
                  reservation.canViewPrice
                    ? 'قيمة مثبّتة وقت الحجز ولا تتأثر بتغيير الأسعار لاحقًا.'
                    : 'يتطلب صلاحية عرض الأسعار.'
                }
              />
            </dl>
          </AdminCard>

          <AdminCard title="سجل الحالات">
            <ol className="divide-y divide-ink-200">
              {reservation.timeline.map((entry, index) => (
                <li key={index} className="flex items-start gap-3 px-5 py-3.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-700">
                      {entry.fromStatus
                        ? `${RESERVATION_STATUS[entry.fromStatus]?.ar ?? entry.fromStatus} ← ${RESERVATION_STATUS[entry.toStatus]?.ar ?? entry.toStatus}`
                        : (RESERVATION_STATUS[entry.toStatus]?.ar ?? entry.toStatus ?? 'غير محدد')}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {formatDateTime(entry.createdAt)}
                      {entry.changedByEmail ? ` · ${entry.changedByEmail}` : ' · النظام'}
                    </p>
                    {entry.note && (
                      <p className="mt-1 rounded-md bg-ink-50 px-2 py-1 text-xs text-ink-600">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </AdminCard>
        </div>

        <div className="space-y-5">
          <AdminCard title="إجراءات">
            <div className="p-5">
              {session.permissions.has('manage_reservations') ? (
                <StatusControl
                  reservationId={reservation.id}
                  status={reservation.status}
                  deliveryMethod={reservation.deliveryMethod}
                  canAnonymize
                />
              ) : (
                <p className="text-sm text-ink-400">ليس لديك صلاحية تعديل الحجوزات.</p>
              )}
            </div>
          </AdminCard>

          <AdminCard title="معلومات إضافية">
            <dl className="divide-y divide-ink-200">
              <Row
                label="صلاحية الحجز"
                value={
                  ['RECEIVED', 'CONFIRMED'].includes(reservation.status)
                    ? formatDateTime(reservation.expiresAt)
                    : '—'
                }
              />
              <Row
                label="رمز QR"
                value={
                  reservation.qrUsedAt ? (
                    <span className="inline-flex items-center gap-1.5 text-[#8E2434]">
                      <QrCode className="size-3.5" aria-hidden="true" />
                      استُخدم {formatDateTime(reservation.qrUsedAt)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[#12613C]">
                      <QrCode className="size-3.5" aria-hidden="true" />
                      لم يُستخدم بعد
                    </span>
                  )
                }
              />
              <Row
                label="المخزون"
                value={reservation.stockReleased ? 'أُعيد إلى المخزون' : 'محجوز'}
              />
            </dl>

            <div className="border-t border-ink-200 p-5">
              <a
                href={`/api/admin/reservations/${reservation.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink-300 px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
              >
                <Printer className="size-4" aria-hidden="true" />
                نسخة للطباعة
              </a>
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <dt className="shrink-0 text-sm text-ink-500">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-ink-400">{hint}</span>}
      </dt>
      <dd className="text-end text-sm text-ink-800">{value}</dd>
    </div>
  );
}