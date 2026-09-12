'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Countdown } from './countdown';
import { useSelectionStore } from '@/stores/selection-store';
import { routes } from '@/config/site';
import { motion as motionTokens } from '@/config/brand';
import type { BookingWindow, PublicProduct } from '@/types/domain';

interface HeroProps {
  product: PublicProduct | null;
  bookingWindow: BookingWindow;
  maintenanceMessage: string;
}

// خريطة ربط الألوان بالصور
const colorImageMap: Record<string, string> = {
  // العنابي
  burgundy: '/images/products/iphone-burgundy.png',
  '#8e2434': '/images/products/iphone-burgundy.png',
  '#6b1f2e': '/images/products/iphone-burgundy.png',

  // السيلفر / الفضي
  silver: '/images/products/iphone-silver.png',
  white: '/images/products/iphone-silver.png',
  '#e2e4e5': '/images/products/iphone-silver.png',

  // الأسود / التيتانيوم
  black: '/images/products/iphone-black.png',
  titanium: '/images/products/iphone-black.png',
  dark: '/images/products/iphone-black.png',
  '#2b2b2e': '/images/products/iphone-black.png',

  // الأزرق السماوي
  blue: '/images/products/iphone-sky-blue.png',
  'sky-blue': '/images/products/iphone-sky-blue.png',
  skyblue: '/images/products/iphone-sky-blue.png',
  cyan: '/images/products/iphone-sky-blue.png',
  '#a7c7e7': '/images/products/iphone-sky-blue.png',
  '#87ceeb': '/images/products/iphone-sky-blue.png',
};

export function Hero({ product, bookingWindow, maintenanceMessage }: HeroProps) {
  const reduceMotion = useReducedMotion();
  const selected = useSelectionStore((s) => s.selected());

  const rise = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: motionTokens.cinematic,
            delay,
            ease: motionTokens.easeOut,
          },
        };

  // مطابقة اللون المختار مع خريطة الصور، أو العودة للصورة الافتراضية
  const selectedKey = (selected?.id || selected?.name || selected?.hex || '').toLowerCase();
  const activeImageSrc =
    colorImageMap[selectedKey] ||
    product?.heroImagePath ||
    '/images/products/iphone-18-pro-max.png';

  return (
    <section
      id="hero"
      className="relative overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-12"
      aria-labelledby="hero-title"
    >
      <div
        className="product-glow pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
        aria-hidden="true"
      />

      <div className="shell relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="order-2 lg:order-1">
          {product?.isPlaceholder && (
            <motion.p
              {...rise(0)}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-ink-300"
            >
              <span className="size-1.5 rounded-full bg-burgundy-400" aria-hidden="true" />
              التفاصيل الكاملة تُعلن عند الإطلاق
            </motion.p>
          )}

          <motion.h1
            {...rise(0.08)}
            id="hero-title"
            className="text-display-xl font-semibold leading-[1.08] text-balance text-ink-50"
          >
            بدايات تسطع
            <br />
            بالمفاجآت
          </motion.h1>

          <motion.p
            {...rise(0.18)}
            className="mt-6 max-w-prose text-base leading-relaxed text-ink-300 sm:text-lg"
          >
            {product?.taglineAr ??
              'احجز جهازك من المرشد قبل الجميع، واختر الطراز والسعة واللون الذي يناسبك.'}
          </motion.p>

          <motion.div {...rise(0.26)} className="mt-8 flex flex-col gap-3 sm:flex-row">
            {bookingWindow.isOpen ? (
              <Link href={routes.book} className="sm:w-auto">
                <Button size="lg" fullWidth className="sm:w-auto">
                  احجز الآن
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </Button>
              </Link>
            ) : (
              <Button size="lg" disabled className="sm:w-auto" title="الحجز غير متاح حاليًا">
                احجز الآن
              </Button>
            )}

            <a href="#showcase" className="sm:w-auto">
              <Button size="lg" variant="secondary" fullWidth className="sm:w-auto">
                اكتشف الجديد
              </Button>
            </a>
          </motion.div>

          <motion.div {...rise(0.34)} className="mt-10 max-w-md">
            <Countdown window={bookingWindow} maintenanceMessage={maintenanceMessage} />
          </motion.div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: motionTokens.easeOut }}
          className="order-1 flex justify-center lg:order-2"
        >
          <div className="relative mx-auto flex h-[480px] w-64 items-center justify-center sm:h-[540px] sm:w-80 lg:h-[600px] lg:w-full lg:max-w-md">
            {/* إضاءة خلفية تتغير بنعومة مع لون الجهاز */}
            <div
              className="pointer-events-none absolute inset-0 -z-10 scale-90 rounded-full opacity-40 blur-3xl transition-colors duration-700"
              style={{ backgroundColor: selected?.hex ?? '#6B1F2E' }}
              aria-hidden="true"
            />

            {/* صورة الجهاز تتبدل مع حركة تلاشي ناعمة */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeImageSrc}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="relative h-full w-full"
              >
                <Image
                  src={activeImageSrc}
                  alt={product?.nameAr ?? 'iPhone'}
                  fill
                  priority
                  className="object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)]"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <a
        href="#showcase"
        className="mx-auto mt-12 hidden w-fit flex-col items-center gap-1 text-ink-500 transition-colors hover:text-ink-300 lg:flex"
        aria-label="انتقل إلى قسم الجهاز"
      >
        <span className="text-xs">مرّر للأسفل</span>
        <ChevronDown className="size-4 animate-bounce" aria-hidden="true" />
      </a>
    </section>
  );
}