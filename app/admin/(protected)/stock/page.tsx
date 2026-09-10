import { requirePermission } from '@/lib/auth/guard';
import { getStockBoard, getStockHistory } from '@/lib/admin/queries';
import { AdminPage, AdminCard, MetricCard } from '@/components/admin/shell';
import { StockTable } from '@/components/admin/stock-table';
import { formatDateTime, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'المخزون' };

const REASON_LABELS: Record<string, string> = {
  INITIAL_SEED: 'رصيد افتتاحي',
  MANUAL_SET: 'تعيين يدوي',
  MANUAL_ADJUST: 'تعديل يدوي',
  RESERVATION_HOLD: 'حجز عميل',
  RESERVATION_RELEASE: 'إلغاء/انتهاء حجز',
  RESERVATION_FULFILLED: 'تسليم جهاز',
};

export default async function StockPage() {
  await requirePermission('manage_stock');

  const [rows, recentMovements] = await Promise.all([
    getStockBoard(),
    getStockHistory(undefined, 20),
  ]);

  const available = rows.reduce((sum, r) => sum + r.quantity, 0);
  const reserved = rows.reduce((sum, r) => sum + r.reserved_quantity, 0);
  const limited = rows.filter((r) => r.availability === 'LIMITED').length;
  const soldOut = rows.filter((r) => r.availability === 'SOLD_OUT').length;

  return (
    <AdminPage
      title="المخزون"
      description="الكميات المتاحة والمحجوزة لكل خيار."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="وحدات متاحة" value={formatNumber(available)} />
        <MetricCard label="وحدات محجوزة" value={formatNumber(reserved)} hint="بحجوزات نشطة" />
        <MetricCard
          label="كمية محدودة"
          value={formatNumber(limited)}
          tone={limited > 0 ? 'warn' : 'neutral'}
        />
        <MetricCard
          label="نفدت"
          value={formatNumber(soldOut)}
          tone={soldOut > 0 ? 'bad' : 'neutral'}
        />
      </div>

      <AdminCard className="mb-5">
        <StockTable rows={rows} />
      </AdminCard>

      <AdminCard title="آخر حركات المخزون">
        {recentMovements.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-400">لا توجد حركات بعد.</p>
        ) : (
          <ol className="divide-y divide-ink-200">
            {recentMovements.map((movement) => (
              <li key={movement.id} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-700">
                    {movement.product_name_ar} · {movement.capacity_key} · {movement.color_name_ar}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {REASON_LABELS[movement.reason] ?? movement.reason}
                    {movement.reservation_code && (
                      <span className="ltr-nums ms-1 font-mono">({movement.reservation_code})</span>
                    )}
                    {movement.changed_by_email && <> · {movement.changed_by_email}</>}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      movement.delta > 0
                        ? 'text-[#12613C]'
                        : movement.delta < 0
                          ? 'text-[#8E2434]'
                          : 'text-ink-400'
                    }`}
                  >
                    {movement.delta > 0 ? '+' : ''}
                    {formatNumber(movement.delta)}
                  </p>
                  <p className="text-xs text-ink-400">{formatDateTime(movement.created_at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </AdminCard>
    </AdminPage>
  );
}
