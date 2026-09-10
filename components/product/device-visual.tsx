'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The product visual.
 *
 * Al-Murshid has not supplied product photography yet, and the platform must
 * not ship broken image icons while it waits. So: try the configured image, and
 * on error fall back to an original abstract device rendering that takes the
 * selected colour. The page is complete either way, and dropping a real photo
 * into /public/images/products/ upgrades it with no code change.
 */

interface DeviceVisualProps {
  src: string | null;
  alt: string;
  colorHex: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

export function DeviceVisual({
  src, alt, colorHex, priority = false, className, sizes = '(max-width: 768px) 80vw, 40vw',
}: DeviceVisualProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <DevicePlaceholder colorHex={colorHex} label={alt} className={className} />;
  }

  return (
    <div className={cn('relative aspect-[9/19] w-full max-w-full', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        onError={() => setFailed(true)}
        className="object-contain drop-shadow-product"
      />
    </div>
  );
}

/**
 * Original abstract device rendering — a rounded slab with a screen well, a
 * camera plateau and a specular highlight. Drawn from scratch so it evokes a
 * premium phone without reproducing any real product's design.
 */
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

        {/* Body */}
        <rect x="6" y="6" width="168" height="368" rx="34" fill={`url(#body-${id})`} />
        {/* Metallic rail */}
        <rect
          x="6" y="6" width="168" height="368" rx="34"
          fill="none" stroke={`url(#rail-${id})`} strokeWidth="2.5"
        />
        {/* Screen well */}
        <rect x="14" y="14" width="152" height="352" rx="28" fill={`url(#screen-${id})`} />
        {/* Specular sweep */}
        <rect x="14" y="14" width="152" height="352" rx="28" fill={`url(#spec-${id})`} />
        {/* Camera plateau */}
        <rect
          x="26" y="26" width="62" height="62" rx="20"
          fill="#0E0F11" stroke="#ffffff" strokeOpacity="0.1"
        />
        <circle cx="46" cy="46" r="11" fill="#141518" stroke="#ffffff" strokeOpacity="0.14" />
        <circle cx="70" cy="46" r="11" fill="#141518" stroke="#ffffff" strokeOpacity="0.14" />
        <circle cx="46" cy="70" r="11" fill="#141518" stroke="#ffffff" strokeOpacity="0.14" />
        <circle cx="46" cy="46" r="4" fill={colorHex} fillOpacity="0.55" />
        {/* Sensor cutout */}
        <rect x="72" y="24" width="36" height="10" rx="5" fill="#000" fillOpacity="0.7" />
      </svg>
    </div>
  );
}
