'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Minus } from 'lucide-react';
import { UnconfirmedTag } from '@/components/ui/indicators';
import { DevicePlaceholder } from './device-visual';
import { cn } from '@/lib/utils';
import type { PublicProduct, PublicSpec } from '@/types/domain';

/**
 * Interactive comparison between two generations.
 *
 * On mobile this is a toggle between two cards rather than a squeezed two-column
 * table — a comparison you have to scroll sideways to read is not a comparison.
 * On desktop both columns show at once with the differing rows highlighted.
 *
 * Which two products are compared comes from app_settings.compare_product_slugs.
 */

interface ComparisonProps {
  products: PublicProduct[];
  specsByProduct: Record<string, PublicSpec[]>;
}

export function Comparison({ products, specsByProduct }: ComparisonProps) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(1);

  if (products.length < 2) return null;
  const [left, right] = products;
  if (!left || !right) return null;

  // Union of spec keys, so a row appears even when only one side defines it.
  const keys: string[] = [];
  const labels = new Map<string, string>();
  for (const product of [left, right]) {
    for (const spec of specsByProduct[product.id] ?? []) {
      if (!labels.has(spec.key)) {
        labels.set(spec.key, spec.labelAr);
        keys.push(spec.key);
      }
    }
  }

  const valueOf = (productId: string, key: string): PublicSpec | undefined =>
    (specsByProduct[productId] ?? []).find((s) => s.key === key);

  const rows = keys.map((key) => {
    const a = valueOf(left.id, key);
    const b = valueOf(right.id, key);
    return {
      key,
      label: labels.get(key) ?? key,
      a,
      b,
      // Only meaningful when BOTH sides are confirmed; otherwise we would be
      // implying a difference we cannot substantiate.
      differs:
        Boolean(a?.isConfirmed && b?.isConfirmed) && a?.valueAr !== b?.valueAr,
    };
  });

  return (
    <section id="compare" className="scroll-mt-20 py-section" aria-labelledby="compare-title">
      <div className="shell">
        <header className="mb-12 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">المقارنة</p>
          <h2 id="compare-title" className="text-display-md font-semibold text-balance text-ink-50">
            ما الجديد مقارنة بالجيل السابق؟
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-400">
            تُعرض الفروقات فور تأكيد المواصفات رسميًا.
          </p>
        </header>

        {/* Mobile: one product at a time */}
        <div className="lg:hidden">
          <div
            role="tablist"
            aria-label="اختر الجهاز للمقارنة"
            className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5"
          >
            {[left, right].map((product, index) => (
              <button
                key={product.id}
                role="tab"
                type="button"
                aria-selected={activeIndex === index}
                aria-controls={`compare-panel-${index}`}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                  activeIndex === index
                    ? 'bg-white/[0.1] text-ink-50'
                    : 'text-ink-400 hover:text-ink-200',
                )}
              >
                {product.nameAr}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              id={`compare-panel-${activeIndex}`}
              role="tabpanel"
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
              transition={{ duration: 0.3 }}
              className="surface p-5"
            >
              <div className="mx-auto mb-6 w-28">
                <DevicePlaceholder
                  colorHex={activeIndex === 0 ? '#3A3D42' : '#6B1F2E'}
                  label={(activeIndex === 0 ? left : right).nameAr}
                />
              </div>

              <dl className="divide-y divide-white/6">
                {rows.map((row) => {
                  const spec = activeIndex === 0 ? row.a : row.b;
                  return (
                    <div key={row.key} className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-sm text-ink-400">{row.label}</dt>
                      <dd className="text-sm font-medium text-ink-50">
                        {spec?.isConfirmed && spec.valueAr ? spec.valueAr : <UnconfirmedTag />}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Desktop: both at once */}
        <div className="hidden lg:block">
          <div className="surface overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] items-end gap-6 border-b border-white/8 p-8">
              <div />
              {[left, right].map((product, index) => (
                <div key={product.id} className="text-center">
                  <div className="mx-auto mb-4 w-24">
                    <DevicePlaceholder
                      colorHex={index === 0 ? '#3A3D42' : '#6B1F2E'}
                      label={product.nameAr}
                    />
                  </div>
                  <h3 className="text-base font-semibold text-ink-50">{product.nameAr}</h3>
                  {index === 1 && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-burgundy-500/30 bg-burgundy-500/12 px-2.5 py-1 text-xs text-burgundy-300">
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                      الجيل الجديد
                    </span>
                  )}
                </div>
              ))}
            </div>

            <table className="w-full">
              <caption className="sr-only">
                مقارنة المواصفات بين {left.nameAr} و{right.nameAr}
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">المواصفة</th>
                  <th scope="col">{left.nameAr}</th>
                  <th scope="col">{right.nameAr}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <motion.tr
                    key={row.key}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: reduceMotion ? 0 : index * 0.04 }}
                    className={cn(
                      'border-b border-white/6 last:border-0',
                      row.differs && 'bg-burgundy-500/[0.05]',
                    )}
                  >
                    <th
                      scope="row"
                      className="p-5 text-right text-sm font-normal text-ink-400"
                    >
                      {row.label}
                      {row.differs && (
                        <span className="ms-2 inline-block size-1.5 rounded-full bg-burgundy-400 align-middle" aria-label="يوجد اختلاف" />
                      )}
                    </th>
                    {[row.a, row.b].map((spec, cellIndex) => (
                      <td key={cellIndex} className="p-5 text-center text-sm font-medium text-ink-50">
                        {spec?.isConfirmed && spec.valueAr ? (
                          spec.valueAr
                        ) : spec ? (
                          <UnconfirmedTag />
                        ) : (
                          <Minus className="mx-auto size-4 text-ink-600" aria-label="غير متوفر" />
                        )}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
