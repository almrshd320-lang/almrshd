'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DeviceVisualProps {
  src: string | null;
  alt: string;
  colorHex: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

// دالة لتحديد مسار الصورة المطابقة بدقة حسب الاسم أو كود الـ Hex
function getProductImageByColor(colorHex: string, alt: string, fallbackSrc: string | null): string {
  const text = `${alt} ${colorHex}`.toLowerCase();

  // 1. المطابقة عبر الأسماء المعتمدة في الموقع
  if (text.includes('سيلفر') || text.includes('فضي') || text.includes('silver') || text.includes('white') || text.includes('أبيض')) {
    return '/images/products/iphone-silver.png';
  }
  if (text.includes('اسود') || text.includes('أسود') || text.includes('ملكي') || text.includes('black') || text.includes('dark')) {
    return '/images/products/iphone-black.png';
  }
  if (text.includes('سماوي') || text.includes('سمائي') || text.includes('ازرق') || text.includes('أزرق') || text.includes('blue') || text.includes('cyan')) {
    return '/images/products/iphone-sky-blue.png';
  }
  if (text.includes('عنابي') || text.includes('احمر') || text.includes('أحمر') || text.includes('burgundy') || text.includes('red')) {
    return '/images/products/iphone-burgundy.png';
  }

  // 2. تحليل كود الـ Hex حسابياً لضمان الدقة في كل الحالات
  const cleanHex = colorHex.replace('#', '').trim();
  if (cleanHex.length >= 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // الأسود الملكي
    if (r < 75 && g < 75 && b < 75) {
      return '/images/products/iphone-black.png';
    }
    // السيلفر
    if (r > 170 && g > 170 && b > 170 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
      return '/images/products/iphone-silver.png';
    }
    // الأزرق السمائي
    if (b > r + 15 && b > 110) {
      return '/images/products/iphone-sky-blue.png';
    }
    // العنابي
    if (r > g + 20 && r > b + 15) {
      return '/images/products/iphone-burgundy.png';
    }
  }

  return fallbackSrc || '/images/products/iphone-burgundy.png';
}

export function DeviceVisual({
  src,
  alt,
  colorHex,
  priority = false,
  className,
  sizes = '(max-width: 768px) 80vw, 40vw',
}: DeviceVisualProps) {
  const [failed, setFailed] = useState(false);

  // اختيار مسار الصورة المناسب للون المختار
  const activeSrc = getProductImageByColor(colorHex, alt, src);

  if (failed) {
    return <DevicePlaceholder colorHex={colorHex} label={alt} className={className} />;
  }

  return (
    <div className={cn('relative aspect-[9/19] w-full max-w-full', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSrc}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative h-full w-full"
        >
          <Image
            src={activeSrc}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            onError={() => setFailed(true)}
            className="object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)]"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function DevicePlaceholder({
  colorHex,
  label,
  className,
}: {
  colorHex: string;
  label?: string;
  className?: string;
}) {
  const id = colorHex.replace('#', '');

  return (
    <div className={cn('relative aspect-[9/19] w-full max-w-full', className)}>
      <svg
        viewBox="0 0 180 380"
        className="size-full drop-shadow-product"
        role="img"
        aria-label={label ?? 'صورة توضيحية للجهاز'}
      >
        <defs>
          <linearGradient id={`body-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colorHex} stopOpacity="0.95" />
            <stop offset="45%" stopColor={colorHex} />
            <stop offset="100%" stopColor="#0B0C0D" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`rail-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="18%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="82%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id={`screen-${id}`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#1A1C20" />
            <stop offset="100%" stopColor="#08090A" />
          </linearGradient>
          <linearGradient id={`spec-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="6" y="6" width="168" height="368" rx="34" fill={`url(#body-${id})`} />
        <rect
          x="6"
          y="6"
          width="168"
          height="368"
          rx="34"
          fill="none"
          stroke={`url(#rail-${id})`}
          strokeWidth="2.5"
        />
        <rect x="14" y="14" width="152" height="352" rx="28" fill={`url(#screen-${id})`} />
        <rect x="14" y="14" width="152" height="352" rx="28" fill={`url(#spec-${id})`} />
        <rect
          x="26"
          y="26"
          width="62"
          height="62"
          rx="20"
          fill="#0E0F11"
          stroke="#ffffff"
          strokeOpacity="0.1"
        />
        <circle cx="46" cy="46" r="11" fill="#141518" stroke="#ffffff" strokeOpacity="0.14" />
        <circle cx="70" cy="46" r="11" fill="#141518" stroke="#ffffff" strokeOpacity="0.14" />
        <circle cx="46" cy="70" r="11" fill="#141518" stroke="#ffffff" strokeOpacity="0.14" />
        <circle cx="46" cy="46" r="4" fill={colorHex} fillOpacity="0.55" />
        <rect x="72" y="24" width="36" height="10" rx="5" fill="#000" fillOpacity="0.7" />
      </svg>
    </div>
  );
}