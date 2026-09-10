import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TrackForm } from './track-form';
import { routes } from '@/config/site';

export const metadata: Metadata = {
  title: 'تتبع حجزك',
  description: 'تابع حالة حجزك في المرشد باستخدام رقم الحجز ورقم هاتفك.',
  alternates: { canonical: '/track' },
};

export default function TrackPage() {
  return (
    <div className="shell py-10 sm:py-16">
      <Link
        href={routes.home}
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
        العودة للرئيسية
      </Link>

      <div className="mx-auto max-w-lg">
        <header className="mb-8">
          <h1 className="text-display-md font-semibold text-balance text-ink-50">تتبع حجزك</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-400">
            أدخل رقم الحجز ورقم الهاتف الذي استخدمته للاطلاع على حالة حجزك.
          </p>
        </header>

        <TrackForm />
      </div>
    </div>
  );
}
