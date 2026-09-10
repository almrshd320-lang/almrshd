import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guard';
import { getAuditLog, PAGE_SIZE } from '@/lib/admin/queries';
import { AdminPage, AdminCard, AdminTable } from '@/components/admin/shell';
import { formatDateTime, formatNumber } from '@/lib/utils';
import { routes } from '@/config/site';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'سجل التدقيق' };

const ACTION_LABELS: Record<string, string> = {
  'price.update': 'تعديل سعر',
  'stock.set': 'تعيين مخزون',
  'stock.adjust': 'تعديل مخزون',
  'reservation.create': 'إنشاء حجز',
  'reservation.status': 'تغيير حالة حجز',
  'reservation.expire': 'انتهاء صلاحية حجز',
  'reservation.anonymize': 'إخفاء بيانات حجز',
  'qr.scan': 'مسح رمز QR',
  'setting.update': 'تعديل إعداد',
};

/**
 * Audit trail.
 *
 * Append-only at the storage layer: UPDATE and DELETE are blocked by a trigger
 * and no policy grants them to anyone, so what is shown here is what happened.
 * Note also that the actor is stored as a plain uuid plus an email, with no
 * foreign key — deleting a staff account cannot erase what that account did.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  await requirePermission('view_audit_logs');
  const params = await searchParams;

  const page = Math.max(Number(params.page) || 1, 1);
  const action = params.action && ACTION_LABELS[params.action] ? params.action : undefined;

  const { rows, total } = await getAuditLog(page, action);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <AdminPage
      title="سجل التدقيق"
      description={`${formatNumber(total)} عملية مسجّلة — السجل غير قابل للتعديل أو الحذف.`}
    >
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action" className="mb-1.5 block text-xs font-medium text-ink-600">
            نوع العملية
          </label>
          <select
            id="action"
            name="action"
            defaultValue={action ?? ''}
            className="h-10 rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
          >
            <option value="">الكل</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="h-10 rounded-lg bg-burgundy-600 px-5 text-sm font-medium text-white transition-colors hover:bg-burgundy-500"
        >
          تصفية
        </button>
      </form>

      <AdminCard>
        <AdminTable
          caption="سجل العمليات الإدارية"
          headers={['التاريخ', 'المستخدم', 'العملية', 'العنصر', 'قبل', 'بعد', 'السبب']}
          empty={rows.length === 0}
        >
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-ink-50">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">
                {formatDateTime(row.created_at)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-600">
                {row.actor_email ?? (row.actor_type === 'CUSTOMER' ? 'عميل' : 'النظام')}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                  {ACTION_LABELS[row.action] ?? row.action}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-600">
                {row.reservation_code ? (
                  <Link
                    href={`${routes.admin.reservations}?q=${row.reservation_code}`}
                    className="ltr-nums font-mono text-burgundy-600 hover:underline"
                  >
                    {row.reservation_code}
                  </Link>
                ) : (
                  <span className="text-ink-400">{row.entity_type}</span>
                )}
              </td>
              <td className="max-w-[12rem] px-4 py-3">
                <ValueCell value={row.previous_value} />
              </td>
              <td className="max-w-[12rem] px-4 py-3">
                <ValueCell value={row.new_value} />
              </td>
              <td className="max-w-[14rem] truncate px-4 py-3 text-xs text-ink-500">
                {row.reason ?? '—'}
              </td>
            </tr>
          ))}
        </AdminTable>

        {totalPages > 1 && (
          <nav
            aria-label="تصفح الصفحات"
            className="flex items-center justify-between border-t border-ink-200 px-5 py-3"
          >
            <p className="text-xs text-ink-500">
              صفحة {formatNumber(page)} من {formatNumber(totalPages)}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`${routes.admin.audit}?page=${page - 1}${action ? `&action=${action}` : ''}`}
                  className="inline-flex h-9 items-center rounded-lg border border-ink-300 px-4 text-xs font-medium text-ink-700 hover:bg-ink-50"
                >
                  السابق
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`${routes.admin.audit}?page=${page + 1}${action ? `&action=${action}` : ''}`}
                  className="inline-flex h-9 items-center rounded-lg border border-ink-300 px-4 text-xs font-medium text-ink-700 hover:bg-ink-50"
                >
                  التالي
                </Link>
              )}
            </div>
          </nav>
        )}
      </AdminCard>
    </AdminPage>
  );
}

/** Renders a jsonb before/after value compactly, without dumping raw JSON. */
function ValueCell({ value }: { value: unknown }) {
  if (value == null) return <span className="text-xs text-ink-300">—</span>;

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <span className="block space-y-0.5">
        {entries.map(([key, val]) => (
          <span key={key} className="block truncate text-xs text-ink-600">
            <span className="text-ink-400">{key}:</span> {String(val)}
          </span>
        ))}
      </span>
    );
  }

  return <span className="truncate text-xs text-ink-600">{String(value)}</span>;
}
