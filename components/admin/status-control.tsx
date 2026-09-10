'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { updateStatusAction, anonymizeReservationAction } from '@/lib/admin/actions';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/ui/states';
import { RESERVATION_STATUS } from '@/config/statuses';
import { cn } from '@/lib/utils';
import type { ReservationStatus, DeliveryMethod } from '@/types/domain';

/**
 * Status transition control.
 *
 * The buttons offered are computed from the same state machine the database
 * enforces (is_valid_status_transition), so the UI cannot suggest a move that
 * SQL will reject. If they ever disagree, the database wins and the operator
 * sees the reason.
 */

function allowedTransitions(
  from: ReservationStatus,
  deliveryMethod: DeliveryMethod,
): ReservationStatus[] {
  const map: Record<ReservationStatus, ReservationStatus[]> = {
    RECEIVED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['READY', 'CANCELLED'],
    READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
    EXPIRED: [],
  };

  return (map[from] ?? []).filter(
    (to) => !(to === 'OUT_FOR_DELIVERY' && deliveryMethod === 'PICKUP'),
  );
}

export function StatusControl({
  reservationId,
  status,
  deliveryMethod,
  canAnonymize,
}: {
  reservationId: string;
  status: ReservationStatus;
  deliveryMethod: DeliveryMethod;
  canAnonymize: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<ReservationStatus | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);

  const options = allowedTransitions(status, deliveryMethod);
  const terminal = ['DELIVERED', 'CANCELLED', 'EXPIRED'].includes(status);

  const submit = () => {
    if (!target) return;
    setError(null);

    startTransition(async () => {
      const result = await updateStatusAction({
        reservationId,
        status: target,
        note: note.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setTarget(null);
      setNote('');
      router.refresh();
    });
  };

  const anonymize = () => {
    setError(null);
    startTransition(async () => {
      const result = await anonymizeReservationAction(reservationId, 'طلب حذف بيانات');
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnonymizeOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="space-y-3">
        {options.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTarget(option)}
                disabled={isPending}
                className={cn(
                  'inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50',
                  option === 'CANCELLED'
                    ? 'border border-[#E4B4BD] bg-white text-[#8E2434] hover:bg-[#FBE9EC]'
                    : 'bg-burgundy-600 text-white hover:bg-burgundy-500',
                )}
              >
                {RESERVATION_STATUS[option].ar}
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-400">
            هذا الحجز في حالة نهائية ولا يمكن تغييرها.
          </p>
        )}

        {canAnonymize && terminal && (
          <button
            type="button"
            onClick={() => setAnonymizeOpen(true)}
            className="text-xs text-ink-500 underline hover:text-ink-700"
          >
            إخفاء البيانات الشخصية لهذا الحجز
          </button>
        )}

        {error && <InlineError message={error} />}
      </div>

      <Modal
        light
        open={target !== null}
        onClose={() => !isPending && setTarget(null)}
        title="تأكيد تغيير الحالة"
        description={
          target
            ? `سيتم تغيير حالة الحجز إلى «${RESERVATION_STATUS[target].ar}».${
                target === 'CANCELLED' ? ' سيُعاد الجهاز إلى المخزون.' : ''
              }`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="h-11 rounded-lg bg-burgundy-600 px-5 text-sm font-medium text-white transition-colors hover:bg-burgundy-500 disabled:opacity-50"
            >
              {isPending ? 'جارٍ الحفظ…' : 'تأكيد'}
            </button>
            <button
              type="button"
              onClick={() => setTarget(null)}
              disabled={isPending}
              className="h-11 rounded-lg border border-ink-300 px-5 text-sm font-medium text-ink-600 hover:bg-ink-50"
            >
              إلغاء
            </button>
          </>
        }
      >
        <label htmlFor="status-note" className="mb-1.5 block text-sm font-medium text-ink-700">
          ملاحظة (اختياري)
        </label>
        <textarea
          id="status-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="سبب التغيير، أو أي معلومة مفيدة للفريق."
          className="w-full rounded-lg border border-ink-300 p-3 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
        />
        <p className="mt-2 text-xs text-ink-400">
          تُسجَّل كل تغييرات الحالة في سجل التدقيق باسمك.
        </p>
        {error && <InlineError message={error} className="mt-3" />}
      </Modal>

      <Modal
        light
        open={anonymizeOpen}
        onClose={() => !isPending && setAnonymizeOpen(false)}
        title="إخفاء البيانات الشخصية"
        description="سيُحذف اسم العميل ورقم هاتفه ومدينته من هذا الحجز نهائيًا. يبقى سجل الحجز والمخزون كما هو. لا يمكن التراجع."
        footer={
          <>
            <button
              type="button"
              onClick={anonymize}
              disabled={isPending}
              className="h-11 rounded-lg bg-[#A32E3E] px-5 text-sm font-medium text-white hover:bg-[#8E2434] disabled:opacity-50"
            >
              {isPending ? 'جارٍ التنفيذ…' : 'تأكيد الإخفاء'}
            </button>
            <button
              type="button"
              onClick={() => setAnonymizeOpen(false)}
              disabled={isPending}
              className="h-11 rounded-lg border border-ink-300 px-5 text-sm font-medium text-ink-600 hover:bg-ink-50"
            >
              إلغاء
            </button>
          </>
        }
      >
        {error && <InlineError message={error} />}
      </Modal>
    </>
  );
}
