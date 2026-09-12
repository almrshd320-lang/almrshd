'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Minus } from 'lucide-react';
import { UnconfirmedTag } from '@/components/ui/indicators';
import { cn } from '@/lib/utils';
import type { PublicProduct, PublicSpec } from '@/types/domain';

interface ComparisonProps {
  products: PublicProduct[];
  specsByProduct: Record<string, PublicSpec[]>;
}

// دالة لجلب الصورة الحقيقية لكل هاتف
function getCompareImage(product: PublicProduct): string {
  const text = `${product.nameAr} ${product.slug} ${product.id}`.toLowerCase();
  if (text.includes('17')) {
    return '/images/products/iphone-17-pro-max.png';
  }
  if (text.includes('18')) {
    return '/images/products/iphone-18-pro-max.png';
  }
  return product.heroImagePath || '/images/products/iphone-18-pro-max.png';
}

// جدول المواصفات والمقارنة بين الجيلين
const comparisonSpecsData = [
  { key: 'chip', label: 'المعالج', val17: 'A19 Pro', val18: 'A20 Pro' },
  { key: 'battery', label: 'البطارية', val17: '4823 mAh', val18: '5391 mAh' },
  { key: 'weight', label: 'الوزن', val17: '233 غرام', val18: '249 غرام' },
  { key: 'display', label: 'الشاشة', val17: 'OLED 120Hz', val18: 'OLED 120Hz' },
  { key: 'dimensions', label: 'الأبعاد', val17: 'شاشة 6.7 بوصة', val18: 'شاشة 6.7 بوصة' },
  { key: 'camera', label: 'الكاميرا', val17: '48 MP', val18: '48 MP' },
  { key: 'materials', label: 'الخامات', val17: 'هيكل من الألمنيوم', val18: 'هيكل من الألمنيوم' },
  {
    key: 'connectivity',
    label: 'الاتصال',
    val17: 'GSM / CDMA / HSPA / EVDO / LTE / 5G',
    val18: 'GSM / HSPA / LTE / 5G',
  },
];

export function Comparison({ products, specsByProduct }: ComparisonProps) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(1);

  if (products.length < 2) return null;
  const [left, right] = products;
  if (!left || !right) return null;

  const getProductValue = (product: PublicProduct, item: (typeof comparisonSpecsData)[0]) => {
    const is18 =
      product.nameAr?.includes('18') ||
      product.slug?.includes('18') ||
      product.id?.includes('18');
    return is18 ? item.val18 : item.val17;
  };

  const rows = comparisonSpecsData.map((item) => {
    const valA = getProductValue(left, item);
    const valB = getProductValue(right, item);

    const aSpec: PublicSpec = {
      id: `spec-${left.id}-${item.key}`,
      productId: left.id,
      key: item.key,
      labelAr: item.label,
      valueAr: valA,
      isConfirmed: true,
      isHighlight: false,
    } as PublicSpec;

    const bSpec: PublicSpec = {
      id: `spec-${right.id}-${item.key}`,
      productId: right.id,
      key: item.key,
      labelAr: item.label,
      valueAr: valB,
      isConfirmed: true,
      isHighlight: false,
    } as PublicSpec;

    return {
      key: item.key,
      label: item.label,
      a: aSpec,
      b: bSpec,
      differs: valA !== valB,
    };
  });

  const activeProduct = activeIndex === 0 ? left : right;
  const isActive17 =
    activeProduct.nameAr?.includes('17') ||
    activeProduct.slug?.includes('17') ||
    activeProduct.id?.includes('17');

  return (
    <section id="compare" className="scroll-mt-20 py-section" aria-labelledby="compare-title">
      <div className="shell">
        <header className="mb-12 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">المقارنة</p>
          <h2 id="compare-title" className="text-display-md font-semibold text-balance text-ink-50">
            ما الجديد مقارنة بالجيل السابق؟
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-400">
            مقارنة تقنية مباشرة توضح الفروقات وتحديثات العتاد بين الجيلين.
          </p>
        </header>

        {/* عرض الهواتف الذكية */}
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
              <div className="relative mx-auto mb-6 flex h-52 w-36 items-center justify-center">
                <Image
                  src={getCompareImage(activeProduct)}
                  alt={activeProduct.nameAr}
                  fill
                  style={{
                    transform: isActive17
                      ? 'scale(1.35) translateY(-22px)'
                      : 'scale(1)',
                    transformOrigin: 'center center',
                  }}
                  className="object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.7)] transition-transform duration-300"
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

        {/* عرض الشاشات الكبيرة (Desktop) */}
        <div className="hidden lg:block">
          <div className="surface overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] items-end gap-6 border-b border-white/8 p-8">
              <div />
              {[left, right].map((product, index) => {
                const is17 =
                  product.nameAr?.includes('17') ||
                  product.slug?.includes('17') ||
                  product.id?.includes('17');

                return (
                  <div key={product.id} className="text-center">
                    <div className="relative mx-auto mb-4 flex h-52 w-36 items-center justify-center">
                      <Image
                        src={getCompareImage(product)}
                        alt={product.nameAr}
                        fill
                        style={{
                          transform: is17
                            ? 'scale(1.35) translateY(-22px)'
                            : 'scale(1)',
                          transformOrigin: 'center center',
                        }}
                        className="object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.7)] transition-transform duration-300"
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
                );
              })}
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
                        <span
                          className="ms-2 inline-block size-1.5 rounded-full bg-burgundy-400 align-middle"
                          aria-label="يوجد اختلاف"
                          title="مواصفة مطوّرة"
                        />
                      )}
                    </th>
                    {[row.a, row.b].map((spec, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="p-5 text-center text-sm font-medium text-ink-50"
                      >
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