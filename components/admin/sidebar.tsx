'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Tag, Boxes, ScanLine, ScrollText,
  Settings, LogOut, Menu, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { routes } from '@/config/site';
import { cn } from '@/lib/utils';
import type { Permission } from '@/types/domain';

/**
 * Admin navigation.
 *
 * Items are filtered by permission, so a counter-staff account simply does not
 * see Pricing. That is a usability choice, not a security one — the page,
 * the action and the SQL function each re-check independently, so typing the
 * URL directly gets you nowhere.
 */

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission }[] = [
  { href: routes.admin.root, label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: routes.admin.reservations, label: 'الحجوزات', icon: ClipboardList, permission: 'view_reservations' },
  { href: routes.admin.scan, label: 'مسح QR', icon: ScanLine, permission: 'scan_qr' },
  { href: routes.admin.pricing, label: 'الأسعار', icon: Tag, permission: 'view_prices' },
  { href: routes.admin.stock, label: 'المخزون', icon: Boxes, permission: 'manage_stock' },
  { href: routes.admin.audit, label: 'سجل التدقيق', icon: ScrollText, permission: 'view_audit_logs' },
  { href: routes.admin.settings, label: 'الإعدادات', icon: Settings, permission: 'manage_settings' },
];

export function AdminSidebar({
  email,
  fullName,
  permissions,
  storeName,
}: {
  email: string;
  fullName: string | null;
  permissions: Permission[];
  storeName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const permissionSet = new Set(permissions);

  const items = NAV.filter((item) => !item.permission || permissionSet.has(item.permission));

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = routes.admin.login;
  };

  const content = (
    <>
      <div className="px-5 py-5">
        <p className="text-sm font-semibold text-ink-800">{storeName}</p>
        <p className="mt-0.5 text-xs text-ink-500">لوحة الإدارة</p>
      </div>

      <nav aria-label="تنقل الإدارة" className="flex-1 px-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            // Exact match for the dashboard root so it is not "active" on every
            // sub-page; prefix match for the sections.
            const isActive =
              item.href === routes.admin.root
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-burgundy-600 font-medium text-white'
                      : 'text-ink-600 hover:bg-ink-100',
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-ink-200 p-3">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-medium text-ink-700">{fullName ?? email}</p>
          <p className="truncate text-xs text-ink-500">{email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-600 transition-colors hover:bg-ink-100"
        >
          <LogOut className="size-4" aria-hidden="true" />
          تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-200 bg-white px-4 lg:hidden">
        <span className="text-sm font-semibold text-ink-800">{storeName}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-lg text-ink-600 hover:bg-ink-100"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
          />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="absolute left-3 top-3 grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            {content}
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-ink-200 bg-white lg:flex">
        {content}
      </aside>
    </>
  );
}
