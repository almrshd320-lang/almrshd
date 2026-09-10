import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReservationView } from './reservation-view';

/**
 * Reservation confirmation route.
 *
 * Never indexed: it is a private page about one person's order, and it should
 * not appear in a search result under any circumstances (see also the
 * X-Robots-Tag header in next.config.mjs and the robots.txt disallow).
 */
export const metadata: Metadata = {
  title: 'حجزك',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = decodeURIComponent(code).toUpperCase();

  // Reject anything that is not code-shaped before rendering, so this route is
  // not a convenient probe for guessing reservation codes.
  if (!/^MRSH-[0-9A-HJKMNP-TV-Z]{6}$/.test(normalized)) notFound();

  return (
    <div className="shell py-10 sm:py-16">
      <div className="mx-auto max-w-lg">
        <ReservationView code={normalized} />
      </div>
    </div>
  );
}
