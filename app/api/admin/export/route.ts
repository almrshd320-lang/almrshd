import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/guard';
import { buildReservationsCsv } from '@/lib/admin/queries';

/**
 * Reservation CSV export.
 *
 * Requires export_data. The internal price column is included only when the
 * caller ALSO holds view_prices — an export must never become a side door
 * around the pricing permission.
 *
 * The CSV builder neutralises leading =, +, - and @ so a customer name cannot
 * become a formula when the file is opened in Excel.
 */
export async function GET() {
  const session = await getAdminSession();

  if (!session) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
  }

  if (!session.permissions.has('export_data')) {
    return NextResponse.json({ error: 'ليس لديك صلاحية التصدير.' }, { status: 403 });
  }

  try {
    const csv = await buildReservationsCsv(session.permissions.has('view_prices'));
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="almurshid-reservations-${stamp}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[export] failed', error);
    return NextResponse.json({ error: 'تعذّر إنشاء الملف.' }, { status: 500 });
  }
}
