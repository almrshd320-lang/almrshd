import Link from 'next/link';
import { AlertTriangle, PackageX, ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/guard';
import { getDashboardMetrics, getReservations, getStockBoard } from '@/lib/admin/queries';
import { getBookingWindow } from '@/lib/settings';
import { AdminPage, AdminCard, MetricCard, AdminTable } from '@/components/admin/shell';
import { StatusBadge } from '@/components/ui/indicators';
import { formatRelative, formatNumber } from '@/lib/utils';
import { routes } from '@/config/site';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const [session, params] = await Promise.all([requireAdmin(), searchParams]);

  const canSeeReservations = session.permissions.has('view_reservations');

  const [metrics, recent, stock, bookingWindow] = await Promise.all([
    canSeeReservations ? getDashboardMetrics() : Promise.resolve(null),
    canSeeReservations
      ? getReservations({ sort: 'newest', page: 1 })
      : Promise.resolve({ rows: [], total: 0 }),
    session.permissions.has('manage_stock') ? getStockBoard() : Promise.resolve([]),
    getBookingWindow(),
  ]);

  const lowStock = stock.filter((s) => s.availability === 'LIMITED');
  const outOfStock = stock.filter((s) => s.availability === 'SOLD_OUT');

  return (
    <AdminPage
      title={`أهلاً، ${session.fullName ?? session.email}`}
      description="نظرة عامة على الحجوزات والمخزون."
    >
      {params.denied && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2 rounded-xl border border-[#F0C4CC] bg-[#FBE9EC] px-4 py-3 text-sm text-[#8E2434]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ليس لديك صلاحية الوصول إلى تلك الصفحة.
        </div>
      )}

      {/* Booking window is the first thing an operator needs to know. */}
      <div
        className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 ${
          bookingWindow.isOpen
            ? 'border-[#B6E2CC] bg-[#E3F5EC]'
            : 'border-[#F0DDB6] bg-[#FBF3E3]'
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-ink-800">
            {bookingWindow.isOpen ? 'الحجز مفتوح' : 'الحجز مغلق'}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            {
              {
                OPEN: 'العملاء يستطيعون الحجز الآن.',
                NOT_YET_OPEN: 'لم يحن موعد فتح الحجز بعد.',
                MAINTENANCE: 'وضع الصيانة مفعّل — الحجوزات متوقفة مؤقتًا.',
                DISABLED: 'الحجز معطّل من الإعدادات.',
                NOT_CONFIGURED: 'لم يُحدَّد موعد فتح الحجز.',
              }[bookingWindow.reason]
            }
          </p>
        </div>
        {session.permissions.has('manage_settings') && (
          <Link
            href={routes.admin.settings}
            className="text-sm font-medium text-burgundy-600 hover:underline"
          >
            تعديل الإعدادات
          </Link>
        )}
      </div>

      {metrics && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard label="إجمالي الحجوزات" value={formatNumber(metrics.reservations.total)} />
            <MetricCard label="اليوم" value={formatNumber(metrics.reservations.today)} />
            <MetricCard
              label="بانتظار التأكيد"
              value={formatNumber(metrics.reservations.received)}
              tone={metrics.reservations.received > 0 ? 'warn' : 'neutral'}
            />
            <MetricCard label="مؤكدة" value={formatNumber(metrics.reservations.confirmed)} />
            <MetricCard
              label="جاهزة للاستلام"
              value={formatNumber(metrics.reservations.ready)}
              tone="good"
            />
            <MetricCard label="قيد التوصيل" value={formatNumber(metrics.reservations.out_for_delivery)} />
            <MetricCard label="تم التسليم" value={formatNumber(metrics.reservations.delivered)} tone="good" />
            <MetricCard label="ملغاة" value={formatNumber(metrics.reservations.cancelled)} tone="bad" />
            <MetricCard label="منتهية" value={formatNumber(metrics.reservations.expired)} tone="bad" />
            <MetricCard
              label="استلام / توصيل"
              value={`${formatNumber(metrics.reservations.pickup)} / ${formatNumber(metrics.reservations.delivery)}`}
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="وحدات متاحة"
              value={formatNumber(metrics.inventory.total_units)}
              hint="عبر جميع الخيارات"
            />
            <MetricCard
              label="وحدات محجوزة"
              value={formatNumber(metrics.inventory.reserved_units)}
            />
            <MetricCard
              label="خيارات بكمية محدودة"
              value={formatNumber(metrics.inventory.low_stock)}
              tone={metrics.inventory.low_stock > 0 ? 'warn' : 'neutral'}
            />
            <MetricCard
              label="خيارات نفدت"
              value={formatNumber(metrics.inventory.out_of_stock)}
              tone={metrics.inventory.out_of_stock > 0 ? 'bad' : 'neutral'}
            />
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {canSeeReservations && (
          <AdminCard
            title="أحدث الحجوزات"
            action={
              <Link
                href={routes.admin.reservations}
                className="inline-flex items-center gap-1 text-xs font-medium text-burgundy-600 hover:underline"
              >
                عرض الكل
                <ArrowLeft className="size-3" aria-hidden="true" />
              </Link>
            }
          >
            <AdminTable
              caption="أحدث الحجوزات"
              headers={['رقم الحجز', 'العميل', 'الجهاز', 'الحالة', 'منذ']}
              empty={recent.rows.length === 0}
            >
              {recent.rows.slice(0, 8).map((row) => (
                <tr key={row.id} className="hover:bg-ink-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={routes.admin.reservation(row.id)}
                      className="ltr-nums font-mono text-xs font-medium text-burgundy-600 hover:underline"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-3 text-ink-700">
                    {row.customer_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">
                    {row.product_name_ar} · {row.capacity_label_ar} · {row.color_name_ar}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} light />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-400">
                    {formatRelative(row.created_at)}
                  </td>
                </tr>
              ))}
            </AdminTable>
          </AdminCard>
        )}

        {session.permissions.has('manage_stock') && (
          <AdminCard title="تنبيهات المخزون">
            {lowStock.length === 0 && outOfStock.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                لا توجد تنبيهات. المخزون في وضع جيد.
              </p>
            ) : (
              <ul className="divide-y divide-ink-200">
                {outOfStock.map((item) => (
                  <li key={item.variant_id} className="flex items-center gap-3 px-5 py-3">
                    <PackageX className="size-4 shrink-0 text-[#8E2434]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm text-ink-700">
                      <span className="block truncate">
                        {item.product_name_ar} · {item.capacity_label_ar}
                      </span>
                      <span className="text-xs text-ink-500">{item.color_name_ar}</span>
                    </span>
                    <span className="text-xs font-medium text-[#8E2434]">نفد</span>
                  </li>
                ))}
                {lowStock.map((item) => (
                  <li key={item.variant_id} className="flex items-center gap-3 px-5 py-3">
                    <AlertTriangle className="size-4 shrink-0 text-[#8A5A12]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm text-ink-700">
                      <span className="block truncate">
                        {item.product_name_ar} · {item.capacity_label_ar}
                      </span>
                      <span className="text-xs text-ink-500">{item.color_name_ar}</span>
                    </span>
                    <span className="text-xs font-medium tabular-nums text-[#8A5A12]">
                      {formatNumber(item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        )}
      </div>
    </AdminPage>
  );
}
