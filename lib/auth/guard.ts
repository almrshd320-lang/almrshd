import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Permission } from '@/types/domain';

/**
 * Admin authorization.
 *
 * The middleware keeps unauthenticated visitors out of /admin, but that is a
 * routing convenience, not the security boundary. Every page and every action
 * re-checks here, and the database re-checks again inside each RPC. Three
 * independent layers, because hiding a route protects nothing.
 */

export interface AdminSession {
  userId: string;
  email: string;
  fullName: string | null;
  permissions: Set<Permission>;
}

/**
 * Current session and permission set, or null. Cached per request so a page
 * rendering six permission-gated panels makes one round trip, not six.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createServerSupabase();

  // getUser() revalidates the JWT against Supabase. getSession() would trust a
  // cookie the browser could have tampered with.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const [{ data: permissionRows }, { data: profile }] = await Promise.all([
    supabase.rpc('my_permissions'),
    supabase
      .from('profiles')
      .select('full_name, is_active')
      .eq('id', userData.user.id)
      .single(),
  ]);

  // A deactivated account keeps a valid JWT until it expires; deny immediately.
  if (profile && profile.is_active === false) return null;

  const permissions = new Set<Permission>(
    ((permissionRows ?? []) as { permission_key: string }[]).map(
      (r) => r.permission_key as Permission,
    ),
  );

  // No roles at all means the account exists but has not been granted access.
  if (permissions.size === 0) return null;

  return {
    userId: userData.user.id,
    email: userData.user.email ?? '',
    fullName: profile?.full_name ?? null,
    permissions,
  };
});

/** Redirects to sign-in unless a valid staff session exists. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

/** Redirects unless the session also holds a specific permission. */
export async function requirePermission(permission: Permission): Promise<AdminSession> {
  const session = await requireAdmin();
  if (!session.permissions.has(permission)) redirect('/admin?denied=' + permission);
  return session;
}

/**
 * For Server Actions, which must return an error rather than redirect.
 * The database checks the same permission again — this only produces a better
 * message than a raw SQL exception.
 */
export async function assertPermission(
  permission: Permission,
): Promise<{ ok: true; session: AdminSession } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: 'يجب تسجيل الدخول.' };
  if (!session.permissions.has(permission)) {
    return { ok: false, error: 'ليس لديك صلاحية لهذا الإجراء.' };
  }
  return { ok: true, session };
}

export function can(session: AdminSession | null, permission: Permission): boolean {
  return session?.permissions.has(permission) ?? false;
}
