import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/site';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="max-w-md text-center">
        <p className="font-mono text-6xl font-semibold text-white/[0.08]">404</p>

        <h1 className="mt-4 text-display-sm font-semibold text-ink-50">
          الصفحة غير موجودة
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-400">
          الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={routes.home}>
            <Button size="lg" fullWidth className="sm:w-auto">
              العودة للرئيسية
            </Button>
          </Link>
          <Link href={routes.track}>
            <Button size="lg" variant="secondary" fullWidth className="sm:w-auto">
              تتبع حجزك
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
