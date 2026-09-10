'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, History, TrendingUp, TrendingDown } from 'lucide-react';
import { setPriceAction } from '@/lib/admin/actions';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/ui/states';
import { AdminTable } from './shell';
import { formatCurrencyLyd, formatDateTime, formatNumber, cn } from '@/lib/utils';
import type { PricingRow, PriceHistoryRow } from '@/types/domain';

/**
 * Internal pricing management.
 *
 * This table exists in exactly one place in the product, behind view_prices,
 * and these numbers are never sent to any customer-facing route.
 *
 * Editing a price writes a price_history row and an audit row in the same
 * transaction as the update. Existing reservations keep the price they were
 * created at — the snapshot in reservation_pricing is immutable, so a raise
 * here can never retroactively change what a customer was quoted.
 */

export function PricingTable({
  rows,
  canEdit,
  loadHistory,
}: {
  rows: PricingRow[];
  canEdit: boolean;
  loadHistory: (variantId: string) => Promise<PriceHistoryRow[]>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState<PricingRow | null>(null);
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [historyFor, setHistoryFor] = useState<PricingRow | null>(null);
  const [history, setHistory] = useState<PriceHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openEdit = (row: PricingRow) => {
    setEditing(row);
    setPrice(row.price_lyd != null ? String(row.price_lyd) : '');
    setReason('');
    setError(null);
  };

  const openHistory = async (row: PricingRow) => {
    setHistoryFor(row);
    setHistoryLoading(true);
    try {
      setHistory(await loadHistory(row.variant_id));
    } finally {
      setHistoryLoading(false);
    }
  };

  const save = () => {
    if (!editing) return;
    setError(null);

    startTransition(async () => {
      const result = await setPriceAction({
        variantId: editing.variant_id,
        price,
        reason: reason.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setEditing(null);
      router.refresh();
    });
  };

  const delta =
    editing && editing.price_lyd != null && price !== ''
      ? Number(price) - editing.price_lyd
      : null;

  return (
    <>
      <AdminTable
        caption="الأسعار الداخلية لكل خيار"
        headers={['الجهاز', 'السعة', 'اللون', 'السعر الداخلي', 'المخزون', 'آخر تحديث', '']}
        empty={rows.length === 0}
      >
        {rows.map((row) => (
          <tr key={row.variant_id} className="hover:bg-ink-50">
            <td className="whitespace-nowrap px-4 py-3 text-ink-700">{row.product_name_ar}</td>
            <td className="whitespace-nowrap px-4 py-3 text-ink-600">{row.capacity_label_ar}</td>
            <td className="whitespace-nowrap px-4 py-3">
              <span className="flex items-center gap-2 text-ink-600">
                <span
                  className="size-3.5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: row.color_hex }}
                  aria-hidden="true"
                />
                {row.color_name_ar}
              </span>
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              {row.price_lyd != null ? (
                <span className="font-semibold tabular-nums text-ink-800">
                  {formatCurrencyLyd(row.price_lyd)}
                </span>
              ) : (
                <span className="rounded-md bg-[#FBF3E3] px-2 py-0.5 text-xs font-medium text-[#8A5A12]">
                  لم يُحدَّد
                </span>
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-600">
              {formatNumber(row.quantity ?? 0)}
              {row.reserved_quantity > 0 && (
                <span className="ms-1 text-xs text-ink-400">
                  (+{formatNumber(row.reserved_quantity)} محجوز)
                </span>
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-400">
              {row.price_updated_at ? (
                <>
                  {formatDateTime(row.price_updated_at)}
                  {row.price_updated_by && (
                    <span className="block text-ink-400">{row.price_updated_by}</span>
                  )}
                </>
              ) : (
                '—'
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-end">
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => openHistory(row)}
                  aria-label={`سجل أسعار ${row.product_name_ar} ${row.capacity_label_ar} ${row.color_name_ar}`}
                  className="grid size-9 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100"
                >
                  <History className="size-4" aria-hidden="true" />
                </button>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    aria-label={`تعديل سعر ${row.product_name_ar} ${row.capacity_label_ar} ${row.color_name_ar}`}
                    className="grid size-9 place-items-center rounded-lg text-burgundy-600 transition-colors hover:bg-burgundy-50"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      {/* Edit */}
      <Modal
        light
        open={editing !== null}
        onClose={() => !isPending && setEditing(null)}
        title="تعديل السعر الداخلي"
        description={
          editing
            ? `${editing.product_name_ar} · ${editing.capacity_label_ar} · ${editing.color_name_ar}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={save}
              disabled={isPending || price === ''}
              className="h-11 rounded-lg bg-burgundy-600 px-5 text-sm font-medium text-white transition-colors hover:bg-burgundy-500 disabled:opacity-50"
            >
              {isPending ? 'جارٍ الحفظ…' : 'حفظ السعر'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={isPending}
              className="h-11 rounded-lg border border-ink-300 px-5 text-sm font-medium text-ink-600 hover:bg-ink-50"
            >
              إلغاء
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-ink-700">
              السعر (د.ل)
            </label>
            <input
              id="price"
              type="number"
              inputMode="decimal"
              min={0}
              max={999999}
              step="0.01"
              dir="ltr"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-12 w-full rounded-lg border border-ink-300 px-4 text-left text-base tabular-nums text-ink-800 focus:border-burgundy-500 focus:outline-none"
            />

            {editing?.price_lyd != null && (
              <p className="mt-2 text-xs text-ink-500">
                السعر الحالي:{' '}
                <span className="font-medium tabular-nums">
                  {formatCurrencyLyd(editing.price_lyd)}
                </span>
                {delta != null && delta !== 0 && (
                  <span
                    className={cn(
                      'ms-2 inline-flex items-center gap-1 font-medium',
                      delta > 0 ? 'text-[#8E2434]' : 'text-[#12613C]',
                    )}
                  >
                    {delta > 0 ? (
                      <TrendingUp className="size-3" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="size-3" aria-hidden="true" />
                    )}
                    {delta > 0 ? '+' : ''}
                    {formatCurrencyLyd(delta)}
                  </span>
                )}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-ink-700">
              سبب التغيير (اختياري)
            </label>
            <input
              id="reason"
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تحديث سعر المورّد"
              className="h-11 w-full rounded-lg border border-ink-300 px-4 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
            />
          </div>

          <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-xs leading-relaxed text-ink-500">
            الحجوزات الحالية تحتفظ بسعرها وقت الحجز ولا تتأثر بهذا التغيير. يُسجَّل
            التغيير في سجل الأسعار وسجل التدقيق باسمك.
          </p>

          {error && <InlineError message={error} />}
        </div>
      </Modal>

      {/* History */}
      <Modal
        light
        size="lg"
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        title="سجل الأسعار"
        description={
          historyFor
            ? `${historyFor.product_name_ar} · ${historyFor.capacity_label_ar} · ${historyFor.color_name_ar}`
            : undefined
        }
      >
        {historyLoading ? (
          <p className="py-8 text-center text-sm text-ink-400">جارٍ التحميل…</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">لا يوجد سجل لهذا الخيار.</p>
        ) : (
          <ol className="divide-y divide-ink-200">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm text-ink-800">
                    {entry.previous_price != null ? (
                      <>
                        <span className="tabular-nums text-ink-400 line-through">
                          {formatCurrencyLyd(entry.previous_price)}
                        </span>
                        <span className="mx-2 text-ink-400">←</span>
                      </>
                    ) : (
                      <span className="me-2 text-xs text-ink-400">تسعير أولي</span>
                    )}
                    <span className="font-semibold tabular-nums">
                      {formatCurrencyLyd(entry.new_price)}
                    </span>
                  </p>
                  {entry.reason && <p className="mt-1 text-xs text-ink-500">{entry.reason}</p>}
                </div>
                <div className="shrink-0 text-end text-xs text-ink-400">
                  <p>{formatDateTime(entry.created_at)}</p>
                  {entry.changed_by_email && <p>{entry.changed_by_email}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}
