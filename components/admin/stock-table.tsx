'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Pencil, History } from 'lucide-react';
import { setStockAction, adjustStockAction, getStockHistoryAction } from '@/lib/admin/actions';
import type { StockLedgerEntry } from '@/types/domain';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/ui/states';
import { AdminTable } from './shell';
import { formatDateTime, formatNumber, cn } from '@/lib/utils';
import type { StockRow } from '@/lib/admin/queries';

/**
 * Inventory management.
 *
 * Two ways to change stock, on purpose:
 *   • +1 / −1 quick adjust for the common case (a unit arrived, a unit was
 *     damaged), which uses a DELTA so two staff members adjusting at once do
 *     not overwrite each other;
 *   • "set exact" for a stocktake, which writes an absolute value.
 *
 * Both write a stock_history row and an audit row. Neither can drive the count
 * below zero: the RPC refuses, and the CHECK constraint refuses after that.
 */

const REASON_LABELS: Record<string, string> = {
  INITIAL_SEED: 'رصيد افتتاحي',
  MANUAL_SET: 'تعيين يدوي',
  MANUAL_ADJUST: 'تعديل يدوي',
  RESERVATION_HOLD: 'حجز عميل',
  RESERVATION_RELEASE: 'إلغاء/انتهاء حجز',
  RESERVATION_FULFILLED: 'تسليم جهاز',
};

export function StockTable({ rows }: { rows: StockRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editing, setEditing] = useState<StockRow | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyVariant, setBusyVariant] = useState<string | null>(null);

  const [historyFor, setHistoryFor] = useState<StockRow | null>(null);
  const [history, setHistory] = useState<StockLedgerEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const quickAdjust = (row: StockRow, delta: number) => {
    setError(null);
    setBusyVariant(row.variant_id);

    startTransition(async () => {
      const result = await adjustStockAction({
        variantId: row.variant_id,
        delta,
        reason: delta > 0 ? 'إضافة سريعة' : 'خصم سريع',
      });
      setBusyVariant(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const saveExact = () => {
    if (!editing) return;
    setError(null);

    startTransition(async () => {
      const result = await setStockAction({
        variantId: editing.variant_id,
        quantity,
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

  const openHistory = async (row: StockRow) => {
    setHistoryFor(row);
    setHistoryLoading(true);
    try {
      setHistory(await getStockHistoryAction(row.variant_id));
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <>
      {error && <InlineError message={error} className="mb-4" />}

      <AdminTable
        caption="المخزون لكل خيار"
        headers={['الجهاز', 'السعة', 'اللون', 'المتاح', 'محجوز', 'الحالة', 'آخر تحديث', '']}
        empty={rows.length === 0}
      >
        {rows.map((row) => {
          const busy = busyVariant === row.variant_id;

          return (
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
                <span className="font-semibold tabular-nums text-ink-800">
                  {formatNumber(row.quantity)}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-500">
                {formatNumber(row.reserved_quantity)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs font-medium',
                    row.availability === 'IN_STOCK' && 'border-[#B6E2CC] bg-[#E3F5EC] text-[#12613C]',
                    row.availability === 'LIMITED' && 'border-[#F0DDB6] bg-[#FBF3E3] text-[#8A5A12]',
                    row.availability === 'SOLD_OUT' && 'border-[#F0C4CC] bg-[#FBE9EC] text-[#8E2434]',
                  )}
                >
                  {row.availability === 'IN_STOCK'
                    ? 'متوفر'
                    : row.availability === 'LIMITED'
                      ? 'كمية محدودة'
                      : 'نفد'}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-400">
                {formatDateTime(row.updated_at)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-end">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => quickAdjust(row, -1)}
                    disabled={busy || isPending || row.quantity === 0}
                    aria-label={`إنقاص كمية ${row.sku}`}
                    className="grid size-9 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 disabled:opacity-30"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => quickAdjust(row, 1)}
                    disabled={busy || isPending}
                    aria-label={`زيادة كمية ${row.sku}`}
                    className="grid size-9 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 disabled:opacity-30"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openHistory(row)}
                    aria-label={`سجل مخزون ${row.sku}`}
                    className="grid size-9 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100"
                  >
                    <History className="size-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditing(row);
                      setQuantity(String(row.quantity));
                      setReason('');
                      setError(null);
                    }}
                    aria-label={`تعيين كمية ${row.sku}`}
                    className="grid size-9 place-items-center rounded-lg text-burgundy-600 transition-colors hover:bg-burgundy-50"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <Modal
        light
        open={editing !== null}
        onClose={() => !isPending && setEditing(null)}
        title="تعيين الكمية"
        description={
          editing
            ? `${editing.product_name_ar} · ${editing.capacity_label_ar} · ${editing.color_name_ar}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={saveExact}
              disabled={isPending || quantity === ''}
              className="h-11 rounded-lg bg-burgundy-600 px-5 text-sm font-medium text-white hover:bg-burgundy-500 disabled:opacity-50"
            >
              {isPending ? 'جارٍ الحفظ…' : 'حفظ'}
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
            <label htmlFor="quantity" className="mb-1.5 block text-sm font-medium text-ink-700">
              الكمية المتاحة
            </label>
            <input
              id="quantity"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000000}
              step={1}
              dir="ltr"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-12 w-full rounded-lg border border-ink-300 px-4 text-left text-base tabular-nums text-ink-800 focus:border-burgundy-500 focus:outline-none"
            />
            {editing && (
              <p className="mt-2 text-xs text-ink-500">
                الكمية الحالية:{' '}
                <span className="font-medium tabular-nums">{formatNumber(editing.quantity)}</span>
                {editing.reserved_quantity > 0 && (
                  <> · محجوز حاليًا: {formatNumber(editing.reserved_quantity)}</>
                )}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="stock-reason" className="mb-1.5 block text-sm font-medium text-ink-700">
              السبب (اختياري)
            </label>
            <input
              id="stock-reason"
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: جرد المخزون"
              className="h-11 w-full rounded-lg border border-ink-300 px-4 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
            />
          </div>

          <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-xs leading-relaxed text-ink-500">
            هذه العملية تعيّن قيمة مطلقة. لتعديل بسيط استخدم أزرار + و − لتفادي
            الكتابة فوق تعديل زميل يعمل في نفس اللحظة.
          </p>

          {error && <InlineError message={error} />}
        </div>
      </Modal>

      <Modal
        light
        size="lg"
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        title="سجل حركة المخزون"
        description={
          historyFor
            ? `${historyFor.product_name_ar} · ${historyFor.capacity_label_ar} · ${historyFor.color_name_ar}`
            : undefined
        }
      >
        {historyLoading ? (
          <p className="py-8 text-center text-sm text-ink-400">جارٍ التحميل…</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">لا توجد حركات مسجّلة.</p>
        ) : (
          <ol className="divide-y divide-ink-200">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm text-ink-800">
                    <span className="tabular-nums text-ink-400">
                      {formatNumber(entry.previous_quantity)}
                    </span>
                    <span className="mx-2 text-ink-400">←</span>
                    <span className="font-semibold tabular-nums">
                      {formatNumber(entry.new_quantity)}
                    </span>
                    <span
                      className={cn(
                        'ms-2 text-xs font-medium tabular-nums',
                        entry.delta > 0 ? 'text-[#12613C]' : entry.delta < 0 ? 'text-[#8E2434]' : 'text-ink-400',
                      )}
                    >
                      {entry.delta > 0 ? '+' : ''}
                      {formatNumber(entry.delta)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {REASON_LABELS[entry.reason] ?? entry.reason}
                    {entry.reservation_code && (
                      <span className="ltr-nums ms-1 font-mono">({entry.reservation_code})</span>
                    )}
                  </p>
                  {entry.note && <p className="mt-1 text-xs text-ink-400">{entry.note}</p>}
                </div>
                <div className="shrink-0 text-end text-xs text-ink-400">
                  <p>{formatDateTime(entry.created_at)}</p>
                  <p>{entry.changed_by_email ?? 'النظام'}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}
