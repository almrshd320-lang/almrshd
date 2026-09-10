'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Globe, Lock } from 'lucide-react';
import { updateSettingAction } from '@/lib/admin/actions';
import { InlineError } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import type { SettingRow } from '@/lib/admin/queries';

/**
 * Settings editor.
 *
 * Every operational rule in the platform is here: whether booking is open, when
 * it opens, how long a reservation lives, whether pickup or delivery is
 * offered, and the emergency stop. The UI reflects these values, and the
 * BACKEND enforces them independently — flipping maintenance_mode here stops
 * reservations at the database, not merely in the interface.
 *
 * The editor is typed by value shape rather than by a hard-coded list, so a new
 * setting row added in SQL appears here automatically.
 */

const CRITICAL = new Set(['booking_enabled', 'maintenance_mode', 'booking_launch_at']);

const GROUPS: { title: string; keys: string[] }[] = [
  {
    title: 'الحجز',
    keys: ['booking_enabled', 'maintenance_mode', 'maintenance_message_ar', 'booking_launch_at',
           'reservation_expiry_hours', 'pickup_enabled', 'delivery_enabled'],
  },
  { title: 'المتجر', keys: ['store_name', 'store_name_en', 'announcement_ar', 'currency', 'show_exact_stock'] },
  { title: 'التواصل', keys: ['contact_phone', 'whatsapp_number', 'social_instagram', 'social_facebook', 'social_tiktok'] },
  { title: 'المحتوى', keys: ['trust_pickup_note_ar', 'trust_delivery_note_ar', 'trust_payment_note_ar',
                              'primary_product_slug', 'compare_product_slugs'] },
];

export function SettingsForm({ settings }: { settings: SettingRow[] }) {
  const byKey = new Map(settings.map((s) => [s.key, s]));
  const grouped = GROUPS.map((group) => ({
    ...group,
    rows: group.keys.map((key) => byKey.get(key)).filter((r): r is SettingRow => Boolean(r)),
  }));

  // Anything added to app_settings that this file does not know about.
  const known = new Set(GROUPS.flatMap((g) => g.keys));
  const other = settings.filter((s) => !known.has(s.key));

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <section key={group.title} className="rounded-xl border border-ink-200 bg-white">
          <h2 className="border-b border-ink-200 px-5 py-4 text-sm font-semibold text-ink-700">
            {group.title}
          </h2>
          <div className="divide-y divide-ink-200">
            {group.rows.map((row) => (
              <SettingField key={row.key} row={row} />
            ))}
          </div>
        </section>
      ))}

      {other.length > 0 && (
        <section className="rounded-xl border border-ink-200 bg-white">
          <h2 className="border-b border-ink-200 px-5 py-4 text-sm font-semibold text-ink-700">
            إعدادات أخرى
          </h2>
          <div className="divide-y divide-ink-200">
            {other.map((row) => (
              <SettingField key={row.key} row={row} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SettingField({ row }: { row: SettingRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isBoolean = typeof row.value === 'boolean';
  const isNumber = typeof row.value === 'number';
  const isArray = Array.isArray(row.value);

  const [draft, setDraft] = useState<string>(() => {
    if (isArray) return (row.value as string[]).join(', ');
    if (row.value == null) return '';
    return String(row.value);
  });

  const commit = (nextValue: unknown) => {
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateSettingAction(row.key, nextValue);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  };

  const commitText = () => {
    if (isNumber) {
      const parsed = Number(draft);
      if (!Number.isFinite(parsed)) {
        setError('القيمة يجب أن تكون رقمًا.');
        return;
      }
      commit(parsed);
      return;
    }
    if (isArray) {
      commit(draft.split(',').map((s) => s.trim()).filter(Boolean));
      return;
    }
    commit(draft);
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`setting-${row.key}`}
            className="text-sm font-medium text-ink-700"
          >
            {row.description ?? row.key}
          </label>

          {row.is_public ? (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[0.625rem] text-ink-500"
              title="مرئي للزوار"
            >
              <Globe className="size-2.5" aria-hidden="true" />
              عام
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-[0.625rem] text-ink-500"
              title="داخلي فقط"
            >
              <Lock className="size-2.5" aria-hidden="true" />
              خاص
            </span>
          )}

          {CRITICAL.has(row.key) && (
            <span className="rounded-md bg-[#FBF3E3] px-1.5 py-0.5 text-[0.625rem] font-medium text-[#8A5A12]">
              حرج
            </span>
          )}
        </div>

        <p dir="ltr" className="mt-0.5 text-left font-mono text-[0.6875rem] text-ink-400">
          {row.key}
        </p>

        {error && <InlineError message={error} className="mt-2" />}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-[#12613C]">
            <Check className="size-3.5" aria-hidden="true" />
            حُفظ
          </span>
        )}

        {isBoolean ? (
          <button
            type="button"
            id={`setting-${row.key}`}
            role="switch"
            aria-checked={row.value as boolean}
            disabled={isPending}
            onClick={() => commit(!row.value)}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50',
              row.value ? 'bg-burgundy-600' : 'bg-ink-300',
            )}
          >
            <span
              className={cn(
                'absolute top-1 size-5 rounded-full bg-white transition-all',
                // RTL: "on" sits at the left end of the track.
                row.value ? 'left-1' : 'right-1',
              )}
              aria-hidden="true"
            />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              id={`setting-${row.key}`}
              type={isNumber ? 'number' : 'text'}
              dir={isNumber || row.key.includes('phone') || row.key.includes('social') ? 'ltr' : 'rtl'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitText}
              disabled={isPending}
              className="h-10 w-56 rounded-lg border border-ink-300 px-3 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none disabled:opacity-50 sm:w-72"
            />
            <button
              type="button"
              onClick={commitText}
              disabled={isPending}
              className="h-10 shrink-0 rounded-lg border border-ink-300 px-3 text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
            >
              حفظ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
