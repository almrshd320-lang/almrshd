import Link from 'next/link';
import { Search, Download } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guard';
import { getReservations, PAGE_SIZE } from '@/lib/admin/queries';
import { getAllVariants, getBranches } from '@/lib/catalog';
import { reservationFilterSchema } from '@/lib/validation/schemas';
import { AdminPage, AdminCard, AdminTable } from '@/components/admin/shell';
import { StatusBadge } from '@/components/ui/indicators';
import { formatDateTime, formatNumber, formatRelative, cn } from '@/lib/utils';
import { formatLibyanPhone } from '@/lib/validation/schemas';
import { RESERVATION_STATUS, DELIVERY_METHOD } from '@/config/statuses';
import { routes } from '@/config/site';
import type { ReservationStatus } from '@/types/domain';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'الحجوزات' };

/**
 * Reservation list.
 *
 * Filters are a plain GET form, so the whole thing is server-rendered, every
 * view is a shareable URL, and the browser's back button behaves. No client
 * state, no fetch-on-type, no spinner.
 */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission('view_reservations');
  const rawParams = await searchParams;

  // Unknown or malformed query values fall back to defaults rather than
  // reaching the database.
  const parsed = reservationFilterSchema.safeParse(rawParams);
  const filter = parsed.success ? parsed.data : reservationFilterSchema.parse({});

  const [{ rows, total }, variants, branches] = await Promise.all([
    getReservations(filter),
    getAllVariants(),
    getBranches(),
  ]);

  const products = [...new Map(variants.map((v) => [v.productId, v])).values()];
  const capacities = [...new Map(variants.map((v) => [v.capacityId, v])).values()];
  const colors = [...new Map(variants.map((v) => [v.colorId, v])).values()];

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const pageHref = (page: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) {
      if (value != null && value !== '' && key !== 'page') search.set(key, String(value));
    }
    search.set('page', String(page));
    return `${routes.admin.reservations}?${search.toString()}`;
  };

  return (
    <AdminPage
      title="الحجوزات"
      description={`${formatNumber(total)} حجز`}
      actions={
        session.permissions.has('export_data') ? (
          <a
            href="/api/admin/export"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink-300 bg-white px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
          >
            <Download className="size-4" aria-hidden="true" />
            تصدير CSV
          </a>
        ) : null
      }
    >
      <form method="get" className="mb-5 rounded-xl border border-ink-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-ink-600">
              بحث
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-ink-400"
                aria-hidden="true"
              />
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filter.q ?? ''}
                placeholder="رقم الحجز، الاسم، أو رقم الهاتف"
                className="h-10 w-full rounded-lg border border-ink-300 bg-white ps-9 pe-3 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
              />
            </div>
          </div>

          <FilterSelect
            name="status"
            label="الحالة"
            defaultValue={filter.status ?? ''}
            options={(Object.keys(RESERVATION_STATUS) as ReservationStatus[]).map((key) => ({
              value: key,
              label: RESERVATION_STATUS[key].ar,
            }))}
          />

          <FilterSelect
            name="deliveryMethod"
            label="طريقة الاستلام"
            defaultValue={filter.deliveryMethod ?? ''}
            options={[
              { value: 'PICKUP', label: DELIVERY_METHOD.PICKUP.ar },
              { value: 'DELIVERY', label: DELIVERY_METHOD.DELIVERY.ar },
            ]}
          />

          <FilterSelect
            name="productId"
            label="الطراز"
            defaultValue={filter.productId ?? ''}
            options={products.map((p) => ({ value: p.productId, label: p.productNameAr }))}
          />

          <FilterSelect
            name="capacityId"
            label="السعة"
            defaultValue={filter.capacityId ?? ''}
            options={capacities.map((c) => ({ value: c.capacityId, label: c.capacityLabelAr }))}
          />

          <FilterSelect
            name="colorId"
            label="اللون"
            defaultValue={filter.colorId ?? ''}
            options={colors.map((c) => ({ value: c.colorId, label: c.colorNameAr }))}
          />

          <FilterSelect
            name="branchId"
            label="الفرع"
            defaultValue={filter.branchId ?? ''}
            options={branches.map((b) => ({ value: b.id, label: b.nameAr }))}
          />

          <FilterSelect
            name="sort"
            label="الترتيب"
            defaultValue={filter.sort}
            includeAll={false}
            options={[
              { value: 'newest', label: 'الأحدث أولاً' },
              { value: 'oldest', label: 'الأقدم أولاً' },
              { value: 'expiring', label: 'الأقرب للانتهاء' },
            ]}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-burgundy-600 px-5 text-sm font-medium text-white transition-colors hover:bg-burgundy-500"
          >
            تطبيق
          </button>
          <Link
            href={routes.admin.reservations}
            className="inline-flex h-10 items-center rounded-lg border border-ink-300 px-5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
          >
            إعادة تعيين
          </Link>
        </div>
      </form>

      <AdminCard>
        <AdminTable
          caption="قائمة الحجوزات"
          headers={['رقم الحجز', 'العميل', 'الهاتف', 'الجهاز', 'الاستلام', 'الحالة', 'ينتهي', 'التاريخ']}
          empty={rows.length === 0}
        >
          {rows.map((row) => {
            const expiringSoon =
              ['RECEIVED', 'CONFIRMED'].includes(row.status) &&
              new Date(row.expires_at).getTime() - Date.now() < 6 * 3600 * 1000;

            return (
              <tr key={row.id} className="hover:bg-ink-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={routes.admin.reservation(row.id)}
                    className="ltr-nums font-mono text-xs font-medium text-burgundy-600 hover:underline"
                  >
                    {row.code}
                  </Link>
                </td>
                <td className="max-w-[11rem] truncate px-4 py-3 text-ink-700">
                  {row.customer_name}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <bdi className="ltr-nums text-xs text-ink-600">
                    {formatLibyanPhone(row.customer_phone)}
                  </bdi>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-3 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: row.color_hex }}
                      aria-hidden="true"
                    />
                    {row.product_name_ar} · {row.capacity_label_ar} · {row.color_name_ar}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">
                  {row.branch_name_ar ?? row.delivery_city ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} light />
                </td>
                <td
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-xs',
                    expiringSoon ? 'font-medium text-[#8E2434]' : 'text-ink-400',
                  )}
                >
                  {['RECEIVED', 'CONFIRMED'].includes(row.status)
                    ? formatRelative(row.expires_at)
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-400">
                  {formatDateTime(row.created_at)}
                </td>
              </tr>
            );
          })}
        </AdminTable>

        {totalPages > 1 && (
          <nav
            aria-label="تصفح الصفحات"
            className="flex items-center justify-between border-t border-ink-200 px-5 py-3"
          >
            <p className="text-xs text-ink-500">
              صفحة {formatNumber(filter.page)} من {formatNumber(totalPages)}
            </p>
            <div className="flex gap-2">
              <PageLink href={pageHref(filter.page - 1)} disabled={filter.page <= 1}>
                السابق
              </PageLink>
              <PageLink href={pageHref(filter.page + 1)} disabled={filter.page >= totalPages}>
                التالي
              </PageLink>
            </div>
          </nav>
        )}
      </AdminCard>
    </AdminPage>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  options,
  includeAll = true,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  includeAll?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs font-medium text-ink-600">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
      >
        {includeAll && <option value="">الكل</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-ink-200 px-4 text-xs text-ink-300">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-lg border border-ink-300 px-4 text-xs font-medium text-ink-700 transition-colors hover:bg-ink-50"
    >
      {children}
    </Link>
  );
}
