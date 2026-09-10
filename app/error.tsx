'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/site';

/**
 * Route-level error boundary.
 *
 * Shows a human sentence and a way forward. The underlying error goes to the
 * server log and never to the screen — a database message on a customer-facing
 * page is both alarming and a small information leak.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[route error]', error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-[#FF8A9B]/25 bg-[#FF8A9B]/10">
          <AlertTriangle className="size-6 text-[#FF8A9B]" aria-hidden="true" />
        </span>

        <h1 className="text-display-sm font-semibold text-ink-50">حدث خطأ غير متوقع</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-400">
          تعذّر عرض هذه الصفحة. حاول مرة أخرى، وإذا تكرر الأمر تواصل معنا.
        </p>

        {error.digest && (
          <p className="ltr-nums mt-4 font-mono text-xs text-ink-600">
            رقم الخطأ: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={reset} className="sm:w-auto">
            إعادة المحاولة
          </Button>
          <Link href={routes.home}>
            <Button size="lg" variant="secondary" fullWidth className="sm:w-auto">
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
