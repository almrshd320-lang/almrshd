import { requireAdmin } from '@/lib/auth/guard';
import { getPublicSettings } from '@/lib/settings';
import { AdminSidebar } from '@/components/admin/sidebar';

/**
 * Guarded admin shell.
 *
 * `requireAdmin()` runs on every request to every page in this group. The
 * middleware already turned away anonymous visitors, but middleware runs at the
 * edge and is a routing convenience — this is the check that counts, and each
 * page and action below still re-checks its own specific permission.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, settings] = await Promise.all([requireAdmin(), getPublicSettings()]);

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar
        email={session.email}
        fullName={session.fullName}
        permissions={[...session.permissions]}
        storeName={settings.storeName}
      />
      <main id="main" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
