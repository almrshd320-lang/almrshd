import { AlertTriangle } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guard';
import { getAllSettings } from '@/lib/admin/queries';
import { AdminPage } from '@/components/admin/shell';
import { SettingsForm } from '@/components/admin/settings-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'الإعدادات' };

export default async function SettingsPage() {
  await requirePermission('manage_settings');
  const settings = await getAllSettings();

  return (
    <AdminPage
      title="الإعدادات"
      description="كل قواعد التشغيل تُدار من هنا — بدون الحاجة لإعادة نشر الموقع."
    >
      <div
        role="note"
        className="mb-5 flex items-start gap-3 rounded-xl border border-[#F0DDB6] bg-[#FBF3E3] px-5 py-4"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#8A5A12]" aria-hidden="true" />
        <div className="text-sm leading-relaxed text-[#6B4710]">
          <p className="font-semibold">الإعدادات المعلَّمة «حرج» تؤثر على الحجز مباشرة.</p>
          <p className="mt-1">
            تفعيل «إيقاف الحجوزات مؤقتًا» يمنع أي حجز جديد على مستوى قاعدة البيانات
            فورًا، بينما تبقى صفحة التتبع ولوحة الإدارة تعملان كالمعتاد. تُسجَّل كل
            تغييرات الإعدادات في سجل التدقيق.
          </p>
        </div>
      </div>

      <SettingsForm settings={settings} />
    </AdminPage>
  );
}
