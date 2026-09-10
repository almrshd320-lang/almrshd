import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  // Only a same-site absolute path is honoured. Anything else — a protocol,
  // a protocol-relative "//evil.com", a bare hostname — is dropped, so this
  // parameter can never be turned into an open redirect.
  const next =
    params.next && /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/.test(params.next)
      ? params.next
      : '/admin';

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-ink-800">لوحة إدارة المرشد</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            هذه الصفحة مخصّصة للموظفين المصرّح لهم.
          </p>
        </header>

        <LoginForm next={next} />
      </div>
    </div>
  );
}
