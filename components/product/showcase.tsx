'use client';

import { motion, useReducedMotion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { DeviceVisual } from './device-visual';
import { UnconfirmedTag } from '@/components/ui/indicators';
import { useSelectionStore } from '@/stores/selection-store';
import { cn } from '@/lib/utils';
import type { PublicProduct, PublicSpec } from '@/types/domain';

/**
 * Product showcase and feature grid.
 *
 * Both are driven by product_specs rows. A spec whose is_confirmed is false
 * arrives with a null value (the view withholds it) and renders as
 * "يُعلن لاحقًا" — so unannounced hardware is never presented as fact, and
 * filling in the real numbers later is a database edit, not a deploy.
 */

function iconFor(name: string | null) {
  if (!name) return Icons.Sparkles;
  const pascal = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[pascal];
  return icon ?? Icons.Sparkles;
}

export function ProductShowcase({
  product,
  specs,
}: {
  product: PublicProduct | null;
  specs: PublicSpec[];
}) {
  const reduceMotion = useReducedMotion();
  const selected = useSelectionStore((s) => s.selected());

  if (!product) return null;

  const highlights = specs.filter((s) => s.isHighlight).slice(0, 4);

  return (
    <section id="showcase" className="scroll-mt-20 py-section" aria-labelledby="showcase-title">
      <div className="shell">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="mb-3 text-sm font-medium text-burgundy-400">الجهاز</p>
            <h2
              id="showcase-title"
              className="text-display-lg font-semibold text-balance text-ink-50"
            >
              {product.nameAr}
            </h2>
            {product.descriptionAr && (
              <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-300">
                {product.descriptionAr}
              </p>
            )}

            {highlights.length > 0 && (
              <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-7">
                {highlights.map((spec) => {
                  const Icon = iconFor(spec.icon);
                  return (
                    <div key={spec.id}>
                      <dt className="mb-2 flex items-center gap-2 text-xs text-ink-500">
                        <Icon className="size-3.5" aria-hidden="true" />
                        {spec.labelAr}
                      </dt>
                      <dd className="text-sm font-medium text-ink-100">
                        {spec.isConfirmed && spec.valueAr ? (
                          <>
                            {spec.valueAr}
                            {spec.unitAr && <span className="text-ink-400"> {spec.unitAr}</span>}
                          </>
                        ) : (
                          <UnconfirmedTag />
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center"
          >
            <div className="product-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
            <div className="w-52 sm:w-72">
              <DeviceVisual
                src={product.heroImagePath}
                alt={product.nameAr}
                colorHex={selected?.hex ?? '#6B1F2E'}
                sizes="(max-width: 640px) 55vw, 32vw"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({
  specs,
  productName,
}: {
  specs: PublicSpec[];
  productName: string;
}) {
  const reduceMotion = useReducedMotion();
  if (specs.length === 0) return null;

  return (
    <section id="features" className="scroll-mt-20 py-section" aria-labelledby="features-title">
      <div className="shell">
        <header className="mb-12 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">المواصفات</p>
          <h2 id="features-title" className="text-display-md font-semibold text-balance text-ink-50">
            كل ما تحتاج معرفته عن {productName}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-400">
            نعرض المواصفات المؤكدة فقط. ما لم يُعلن رسميًا يبقى محجوزًا حتى الإطلاق.
          </p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {specs.map((spec, index) => {
            const Icon = iconFor(spec.icon);
            return (
              <motion.li
                key={spec.id}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{
                  duration: 0.45,
                  delay: reduceMotion ? 0 : Math.min(index * 0.05, 0.3),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  'surface flex flex-col gap-3 p-5 transition-colors duration-300',
                  'hover:border-white/16',
                )}
              >
                <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Icon className="size-4 text-burgundy-300" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-medium text-ink-300">{spec.labelAr}</h3>
                <p className="text-base font-semibold text-ink-50">
                  {spec.isConfirmed && spec.valueAr ? (
                    <>
                      {spec.valueAr}
                      {spec.unitAr && (
                        <span className="text-sm font-normal text-ink-400"> {spec.unitAr}</span>
                      )}
                    </>
                  ) : (
                    <UnconfirmedTag />
                  )}
                </p>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
