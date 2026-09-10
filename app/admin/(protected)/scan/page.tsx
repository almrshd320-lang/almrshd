import { requirePermission } from '@/lib/auth/guard';
import { getBranches } from '@/lib/catalog';
import { AdminPage } from '@/components/admin/shell';
import { QrScanner } from '@/components/admin/qr-scanner';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'مسح QR' };

export default async function ScanPage() {
  await requirePermission('scan_qr');
  const branches = await getBranches();

  return (
    <AdminPage
      title="مسح رمز الاستلام"
      description="امسح رمز العميل للتحقق قبل تسليم الجهاز."
    >
      <div className="max-w-xl">
        <QrScanner branches={branches} />

        <div className="mt-5 rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">ملاحظات</h2>
          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-500">
            <li>• يُقبل الرمز مرة واحدة فقط. المحاولة الثانية تُرفض وتُسجَّل.</li>
            <li>• الحجوزات غير المؤكدة لا تُقبل حتى تُحدَّث حالتها.</li>
            <li>• كل محاولة مسح تُسجَّل باسمك، سواء نجحت أو فشلت.</li>
            <li>• التحقق يتم على الخادم — لا يمكن تجاوزه من المتصفح.</li>
          </ul>
        </div>
      </div>
    </AdminPage>
  );
}
