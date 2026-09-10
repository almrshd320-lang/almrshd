import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/guard';
import { getReservationDetail } from '@/lib/admin/queries';
import { RESERVATION_STATUS, DELIVERY_METHOD } from '@/config/statuses';
import { formatDateTime, formatCurrencyLyd } from '@/lib/utils';
import { formatLibyanPhone } from '@/lib/validation/schemas';

/**
 * Printable pick slip for the counter.
 *
 * The internal price is printed only for a user who holds view_prices — the
 * value is already null in the payload otherwise, so this route cannot leak it
 * even if the template were wrong.
 *
 * Every interpolated value is HTML-escaped: customer names are user input, and
 * this response is served as text/html.
 */
export const dynamic = 'force-dynamic';

const escape = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session || !session.permissions.has('view_reservations')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const reservation = await getReservationDetail(id);
  if (!reservation) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const rows: [string, string][] = [
    ['رقم الحجز', reservation.code],
    ['الحالة', RESERVATION_STATUS[reservation.status].ar],
    ['التاريخ', formatDateTime(reservation.createdAt)],
    ['—', ''],
    ['العميل', reservation.customerName],
    ['الهاتف', formatLibyanPhone(reservation.customerPhone)],
    ['المدينة', reservation.customerCity],
    ['—', ''],
    ['الجهاز', reservation.product.nameAr],
    ['السعة', reservation.capacity.labelAr],
    ['اللون', reservation.color.nameAr],
    ['طريقة الاستلام', DELIVERY_METHOD[reservation.deliveryMethod].ar],
    [
      reservation.deliveryMethod === 'PICKUP' ? 'الفرع' : 'مدينة التوصيل',
      reservation.branch?.nameAr ?? reservation.deliveryCity ?? '—',
    ],
  ];

  if (reservation.canViewPrice && reservation.priceAtReservation != null) {
    rows.push(['—', '']);
    rows.push(['السعر الداخلي', formatCurrencyLyd(reservation.priceAtReservation)]);
  }

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(reservation.code)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    margin: 0; padding: 24px; color: #111; background: #fff;
    max-width: 480px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #666; margin: 0 0 20px; }
  .code {
    direction: ltr; text-align: center; font-family: ui-monospace, monospace;
    font-size: 28px; font-weight: 700; letter-spacing: 2px;
    border: 2px solid #111; border-radius: 10px; padding: 14px; margin-bottom: 20px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 8px 0; vertical-align: top; }
  td:first-child { color: #666; width: 40%; }
  td:last-child { font-weight: 600; }
  tr.sep td { padding: 0; }
  tr.sep hr { border: 0; border-top: 1px dashed #ccc; margin: 8px 0; }
  .ltr { direction: ltr; display: inline-block; }
  footer { margin-top: 24px; font-size: 11px; color: #888; text-align: center; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style>
</head>
<body>
  <h1>قسيمة حجز — المرشد</h1>
  <p class="sub">طُبعت في ${escape(formatDateTime(new Date().toISOString()))} · ${escape(session.email)}</p>

  <div class="code">${escape(reservation.code)}</div>

  <table>
    ${rows
      .map(([label, value]) =>
        label === '—'
          ? '<tr class="sep"><td colspan="2"><hr></td></tr>'
          : `<tr><td>${escape(label)}</td><td>${
              label === 'الهاتف' ? `<span class="ltr">${escape(value)}</span>` : escape(value)
            }</td></tr>`,
      )
      .join('\n    ')}
  </table>

  <footer>هذه القسيمة للاستخدام الداخلي فقط.</footer>

  <script>window.addEventListener('load', () => window.print());</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
