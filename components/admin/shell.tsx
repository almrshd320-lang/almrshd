import { cn } from '@/lib/utils';

/**
 * Shared admin page chrome and primitives. Light surface, dense spacing,
 * nothing cinematic — this side of the product is a tool, not a showcase.
 */

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-800 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function AdminCard({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border border-ink-200 bg-white', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-ink-200 px-5 py-4">
          {title && <h2 className="text-sm font-semibold text-ink-700">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p
        className={cn(
          'mt-1.5 text-2xl font-semibold tabular-nums',
          tone === 'neutral' && 'text-ink-800',
          tone === 'good' && 'text-[#12613C]',
          tone === 'warn' && 'text-[#8A5A12]',
          tone === 'bad' && 'text-[#8E2434]',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/**
 * Table wrapper. The horizontal scroll lives here, on one element, so a wide
 * admin table never makes the whole page scroll sideways on a phone.
 */
export function AdminTable({
  headers,
  children,
  caption,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  caption: string;
  empty?: boolean;
}) {
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/60">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-500"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-200">
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-12 text-center text-sm text-ink-400">
                لا توجد بيانات لعرضها.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Where a price would go for a user who cannot see prices.
 *
 * Rendering this rather than an empty cell is deliberate: it tells the person
 * the field exists and is withheld, instead of leaving them wondering whether
 * the data is missing.
 */
export function PriceRedacted() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-xs text-ink-400">
      محجوب
    </span>
  );
}
