import { Lock } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guard';
import { getPricingOverview } from '@/lib/admin/queries';
import { getPriceHistoryAction } from '@/lib/admin/actions';
import { AdminPage, AdminCard } from '@/components/admin/shell';
import { PricingTable } from '@/components/admin/pricing-table';
import { formatCurrencyLyd, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'الأسعار' };

/**
 * Internal pricing.
 *
 * The only screen in the product where a price is rendered. Reaching it needs
 * view_prices; changing anything needs manage_prices; and both are checked
 * again in SQL, so a staff account that somehow loaded this route would receive
 * an empty list rather than a redacted one.
 */
export default async function PricingPage() {
  const session = await requirePermission('view_prices');
  const rows = await getPricingOverview();

  const priced = rows.filter((r) => r.price_lyd != null);
  const unpriced = rows.length - priced.length;
  const total = priced.reduce((sum, r) => sum + (r.price_lyd ?? 0) * (r.quantity ?? 0), 0);

  return (
    <AdminPage
      title="الأسعار الداخلية"
      description="هذه الأسعار غير ظاهرة للعملاء في أي مكان على الموقع."
    >
      <div
        className="mb-5 flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-5 py-4"
        role="note"
      >
        <Lock className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-ink-600">
          الأسعار مخزّنة في جدول منفصل ولا تُرسَل إلى أي صفحة عامة أو واجهة برمجية
          للعملاء. الحجوزات تحتفظ بسعرها وقت الحجز حتى لو تغيّر السعر لاحقًا.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="text-xs text-ink-500">خيارات مسعّرة</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink-800">
            {formatNumber(priced.length)}
            <span className="text-base font-normal text-ink-400"> / {formatNumber(rows.length)}</span>
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="text-xs text-ink-500">بدون سعر</p>
          <p
            className={`mt-1.5 text-2xl font-semibold tabular-nums ${
              unpriced > 0 ? 'text-[#8A5A12]' : 'text-ink-800'
            }`}
          >
            {formatNumber(unpriced)}
          </p>
          {unpriced > 0 && (
            <p className="mt-1 text-xs text-[#8A5A12]">
              الخيارات بدون سعر لا يمكن حجزها.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="text-xs text-ink-500">قيمة المخزون المتاح</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink-800">
            {formatCurrencyLyd(total)}
          </p>
        </div>
      </div>

      <AdminCard>
        <PricingTable
          rows={rows}
          canEdit={session.permissions.has('manage_prices')}
          loadHistory={getPriceHistoryAction}
        />
      </AdminCard>
    </AdminPage>
  );
}
