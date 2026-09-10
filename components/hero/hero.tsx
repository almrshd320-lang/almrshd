'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeviceVisual } from '@/components/product/device-visual';
import { Countdown } from './countdown';
import { useSelectionStore } from '@/stores/selection-store';
import { routes } from '@/config/site';
import { motion as motionTokens } from '@/config/brand';
import type { BookingWindow, PublicProduct } from '@/types/domain';

/**
 * Hero.
 *
 * The one section allowed a cinematic entrance. Everything below it earns
 * attention through hierarchy and spacing rather than movement.
 */

interface HeroProps {
  product: PublicProduct | null;
  bookingWindow: BookingWindow;
  maintenanceMessage: string;
}

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

  return (
    <section
      id="hero"
      className="relative overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-12"
      aria-labelledby="hero-title"
    >
      {/* Product lighting. Re-tints when a colour is selected. */}
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
          <div className="w-52 sm:w-72 lg:w-full lg:max-w-sm">
            <DeviceVisual
              src={product?.heroImagePath ?? null}
              alt={product?.nameAr ?? 'الجهاز'}
              colorHex={selected?.hex ?? '#6B1F2E'}
              priority
              sizes="(max-width: 640px) 60vw, (max-width: 1024px) 40vw, 28vw"
            />
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
