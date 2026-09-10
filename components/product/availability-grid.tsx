import Link from 'next/link';
import { StockIndicator } from '@/components/ui/indicators';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/site';
import { cn } from '@/lib/utils';
import type { PublicVariant } from '@/types/domain';

/**
 * Availability board.
 *
 * A server component: availability comes straight from the database on each
 * render, never from client state. Note what is shown — "متوفر", "كمية محدودة",
 * "نفد" — and what is not: the number. Exact counts are commercial information;
 * the customer needs the state, not the inventory.
 */
export function AvailabilityGrid({
  variants,
  bookingOpen,
}: {
  variants: PublicVariant[];
  bookingOpen: boolean;
}) {
  if (variants.length === 0) return null;

  // Group by capacity, then colour — the two axes a customer actually chooses on.
  const byCapacity = new Map<string, { label: string; sizeGb: number; items: PublicVariant[] }>();
  for (const variant of variants) {
    const existing = byCapacity.get(variant.capacityKey);
    if (existing) existing.items.push(variant);
    else {
      byCapacity.set(variant.capacityKey, {
        label: variant.capacityLabelAr,
        sizeGb: variant.sizeGb,
        items: [variant],
      });
    }
  }

  const groups = [...byCapacity.entries()].sort((a, b) => a[1].sizeGb - b[1].sizeGb);

  return (
    <section id="availability" className="scroll-mt-20 py-section" aria-labelledby="availability-title">
      <div className="shell">
        <header className="mb-12 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">التوفر</p>
          <h2 id="availability-title" className="text-display-md font-semibold text-balance text-ink-50">
            تحقق من توفر الخيار الذي تريده
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-400">
            تُحدَّث حالة التوفر مباشرة. الخيارات التي نفدت لا يمكن حجزها.
          </p>
        </header>

        <div className="space-y-8">
          {groups.map(([capacityKey, group]) => (
            <div key={capacityKey}>
              <h3 className="mb-4 text-sm font-semibold text-ink-200">{group.label}</h3>

              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {group.items.map((variant) => {
                  const soldOut =
                    variant.availability === 'SOLD_OUT' || variant.availability === 'UNAVAILABLE';

                  return (
                    <li
                      key={variant.variantId}
                      className={cn(
                        'surface flex items-center justify-between gap-3 p-4 transition-opacity',
                        soldOut && 'opacity-60',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className="size-7 shrink-0 rounded-full"
                          style={{
                            background: `linear-gradient(140deg, ${variant.gradientTo ?? variant.colorHex}, ${variant.colorHex} 60%, ${variant.gradientFrom ?? variant.colorHex})`,
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16)',
                          }}
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm text-ink-100">{variant.colorNameAr}</span>
                      </span>

                      <StockIndicator availability={variant.availability} size="sm" />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {bookingOpen && (
          <div className="mt-12">
            <Link href={routes.book}>
              <Button size="lg">احجز الآن</Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
