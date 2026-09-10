'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Store, Truck, Pencil } from 'lucide-react';
import { OptionCard } from './option-card';
import { Button } from '@/components/ui/button';
import { Input, Checkbox } from '@/components/ui/field';
import { StockIndicator } from '@/components/ui/indicators';
import { EmptyState } from '@/components/ui/states';
import { useBookingStore, type BookingStep } from '@/stores/booking-store';
import { fullNameSchema, citySchema, libyanPhoneSchema, formatLibyanPhone } from '@/lib/validation/schemas';
import { DELIVERY_METHOD } from '@/config/statuses';
import { cn } from '@/lib/utils';
import type { CatalogTree } from '@/lib/catalog';
import type { PublicBranch, PublicSettings, Availability } from '@/types/domain';

/**
 * The wizard's individual steps.
 *
 * Two rules run through all of them:
 *
 *   1. Options are derived from the catalog data, never hard-coded — step 2
 *      shows only capacities that exist for the chosen model, step 3 only
 *      colours that exist for that model AND capacity.
 *   2. Nothing here displays a price, because no price is available to display:
 *      the types these components receive have no such field.
 */

interface StepProps {
  tree: CatalogTree;
  branches: PublicBranch[];
  settings: PublicSettings;
}

// ─── Step 1: model ───────────────────────────────────────────────────────────

export function StepModel({ tree }: StepProps) {
  const { productId, selectProduct, next } = useBookingStore();

  if (tree.products.length === 0) {
    return (
      <EmptyState
        title="لا توجد أجهزة متاحة للحجز حاليًا"
        description="تابعنا لمعرفة موعد فتح الحجز على الأجهزة الجديدة."
      />
    );
  }

  return (
    <StepShell
      title="اختر الطراز"
      description="أي طراز تريد حجزه؟"
      canContinue={Boolean(productId)}
      onContinue={next}
    >
      <div className="space-y-3">
        {tree.products.map((product) => (
          <OptionCard
            key={product.id}
            title={product.nameAr}
            subtitle={product.taglineAr ?? undefined}
            selected={productId === product.id}
            onSelect={() => selectProduct(product.id)}
          />
        ))}
      </div>
    </StepShell>
  );
}

// ─── Step 2: capacity ────────────────────────────────────────────────────────

export function StepCapacity({ tree }: StepProps) {
  const { productId, capacityId, selectCapacity, next, back } = useBookingStore();

  // Only capacities that actually exist for this model.
  const capacities = productId ? (tree.capacitiesByProduct.get(productId) ?? []) : [];

  return (
    <StepShell
      title="اختر السعة"
      description="كم مساحة تحتاج؟"
      canContinue={Boolean(capacityId)}
      onContinue={next}
      onBack={back}
    >
      {capacities.length === 0 ? (
        <EmptyState title="لا توجد سعات متاحة لهذا الطراز" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {capacities.map((capacity) => (
            <OptionCard
              key={capacity.id}
              title={capacity.labelAr}
              selected={capacityId === capacity.id}
              onSelect={() => selectCapacity(capacity.id)}
            />
          ))}
        </div>
      )}
    </StepShell>
  );
}

// ─── Step 3: colour ──────────────────────────────────────────────────────────

export function StepColor({ tree }: StepProps) {
  const { productId, capacityId, colorId, selectColor, next, back } = useBookingStore();

  const colors =
    productId && capacityId
      ? (tree.colorsByProductCapacity.get(`${productId}:${capacityId}`) ?? [])
      : [];

  const selectable = (availability: Availability) =>
    availability === 'IN_STOCK' || availability === 'LIMITED';

  return (
    <StepShell
      title="اختر اللون"
      description="الألوان غير المتوفرة لا يمكن حجزها."
      canContinue={Boolean(colorId)}
      onContinue={next}
      onBack={back}
    >
      {colors.length === 0 ? (
        <EmptyState title="لا توجد ألوان متاحة لهذا الاختيار" />
      ) : (
        <div className="space-y-3">
          {colors.map((color) => (
            <OptionCard
              key={color.id}
              title={color.nameAr}
              // Out-of-stock variants are disabled at the UI level; the server
              // refuses them again regardless of what the client sends.
              disabled={!selectable(color.availability)}
              selected={colorId === color.id}
              onSelect={() => selectColor(color.id, color.variantId)}
              badge={<StockIndicator availability={color.availability} size="sm" />}
              leading={
                <span
                  className="size-9 shrink-0 rounded-full"
                  style={{
                    background: `linear-gradient(140deg, ${color.gradientTo ?? color.hex}, ${color.hex} 60%, ${color.gradientFrom ?? color.hex})`,
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                  }}
                  aria-hidden="true"
                />
              }
            />
          ))}
        </div>
      )}
    </StepShell>
  );
}

// ─── Step 4: delivery ────────────────────────────────────────────────────────

export function StepDelivery({ branches, settings }: StepProps) {
  const { deliveryMethod, branchId, deliveryCity, setDelivery, next, back } = useBookingStore();

  const methods = [
    { key: 'PICKUP' as const, enabled: settings.pickupEnabled, Icon: Store },
    { key: 'DELIVERY' as const, enabled: settings.deliveryEnabled, Icon: Truck },
  ].filter((m) => m.enabled);

  const ready =
    deliveryMethod === 'PICKUP'
      ? Boolean(branchId)
      : deliveryMethod === 'DELIVERY'
        ? Boolean(deliveryCity && deliveryCity.trim().length >= 2)
        : false;

  return (
    <StepShell
      title="طريقة الاستلام"
      description="كيف تريد استلام جهازك؟"
      canContinue={ready}
      onContinue={next}
      onBack={back}
    >
      {methods.length === 0 ? (
        <EmptyState
          title="لا توجد طريقة استلام متاحة حاليًا"
          description="تواصل معنا لمعرفة التفاصيل."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {methods.map(({ key, Icon }) => (
              <OptionCard
                key={key}
                title={DELIVERY_METHOD[key].ar}
                subtitle={DELIVERY_METHOD[key].hint}
                selected={deliveryMethod === key}
                onSelect={() =>
                  setDelivery(key, key === 'PICKUP' ? (branchId ?? undefined) : undefined,
                    key === 'DELIVERY' ? (deliveryCity ?? undefined) : undefined)
                }
                leading={
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                    <Icon className="size-4 text-burgundy-300" aria-hidden="true" />
                  </span>
                }
              />
            ))}
          </div>

          {deliveryMethod === 'PICKUP' && (
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-medium text-ink-200">اختر الفرع</legend>
              {branches.length === 0 ? (
                <EmptyState title="لا توجد فروع متاحة حاليًا" />
              ) : (
                branches.map((branch) => (
                  <OptionCard
                    key={branch.id}
                    title={branch.nameAr}
                    subtitle={branch.addressAr ?? branch.cityAr}
                    selected={branchId === branch.id}
                    onSelect={() => setDelivery('PICKUP', branch.id)}
                  />
                ))
              )}
            </fieldset>
          )}

          {deliveryMethod === 'DELIVERY' && (
            <Input
              label="مدينة التوصيل"
              required
              value={deliveryCity ?? ''}
              onChange={(e) => setDelivery('DELIVERY', undefined, e.target.value)}
              placeholder="مثال: طرابلس"
              hint="سنتواصل معك لتحديد تفاصيل التوصيل."
              autoComplete="address-level2"
            />
          )}
        </div>
      )}
    </StepShell>
  );
}

// ─── Step 5: customer details ────────────────────────────────────────────────

const detailsSchema = z.object({
  fullName: fullNameSchema,
  // Validate without transforming, so the field keeps showing what was typed.
  phone: z.string().superRefine((value, ctx) => {
    const result = libyanPhoneSchema.safeParse(value);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error.errors[0]?.message ?? 'رقم غير صحيح',
      });
    }
  }),
  city: citySchema,
});

type DetailsForm = z.infer<typeof detailsSchema>;

export function StepDetails() {
  const { fullName, phone, city, setDetails, next, back } = useBookingStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    mode: 'onBlur',
    defaultValues: { fullName, phone, city },
  });

  const onSubmit = handleSubmit((values) => {
    setDetails(values);
    next();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepShell
        title="بياناتك"
        description="نحتاج هذه المعلومات للتواصل معك وتسليم الجهاز فقط."
        canContinue={isValid}
        continueType="submit"
        onBack={back}
      >
        <div className="space-y-5">
          <Input
            label="الاسم الكامل"
            required
            autoComplete="name"
            placeholder="مثال: محمد علي"
            error={errors.fullName?.message}
            {...register('fullName')}
          />

          <Input
            label="رقم الهاتف"
            required
            type="tel"
            inputMode="tel"
            ltr
            autoComplete="tel"
            placeholder="0912345678"
            hint="سنستخدمه للتواصل معك بخصوص الحجز، ولتتبع حجزك لاحقًا."
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Input
            label="المدينة"
            required
            autoComplete="address-level2"
            placeholder="مثال: طرابلس"
            error={errors.city?.message}
            {...register('city')}
          />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-ink-500">
          لا نطلب أي بيانات غير ضرورية، ولا نستخدم بياناتك لغير أغراض هذا الحجز.
        </p>
      </StepShell>
    </form>
  );
}

// ─── Step 6: review ──────────────────────────────────────────────────────────

interface ReviewProps extends StepProps {
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function StepReview({ tree, branches, submitting, error, onSubmit }: ReviewProps) {
  const store = useBookingStore();
  const { setStep, confirmed, setConfirmed, back } = store;

  const product = tree.products.find((p) => p.id === store.productId);
  const capacity = store.productId
    ? tree.capacitiesByProduct.get(store.productId)?.find((c) => c.id === store.capacityId)
    : undefined;
  const color = store.productId && store.capacityId
    ? tree.colorsByProductCapacity
        .get(`${store.productId}:${store.capacityId}`)
        ?.find((c) => c.id === store.colorId)
    : undefined;
  const branch = branches.find((b) => b.id === store.branchId);

  const rows: { label: string; value: string; step: BookingStep }[] = [
    { label: 'الطراز', value: product?.nameAr ?? '—', step: 'model' },
    { label: 'السعة', value: capacity?.labelAr ?? '—', step: 'capacity' },
    { label: 'اللون', value: color?.nameAr ?? '—', step: 'color' },
    {
      label: 'طريقة الاستلام',
      value: store.deliveryMethod ? DELIVERY_METHOD[store.deliveryMethod].ar : '—',
      step: 'delivery',
    },
    {
      label: store.deliveryMethod === 'PICKUP' ? 'الفرع' : 'مدينة التوصيل',
      value: store.deliveryMethod === 'PICKUP' ? (branch?.nameAr ?? '—') : (store.deliveryCity ?? '—'),
      step: 'delivery',
    },
    { label: 'الاسم', value: store.fullName || '—', step: 'details' },
    {
      label: 'رقم الهاتف',
      value: store.phone ? formatLibyanPhone(store.phone) || store.phone : '—',
      step: 'details',
    },
    { label: 'المدينة', value: store.city || '—', step: 'details' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-display-sm font-semibold text-ink-50">راجع طلبك</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          تأكد من صحة البيانات قبل تأكيد الحجز. يمكنك تعديل أي بند.
        </p>
      </header>

      <dl className="surface divide-y divide-white/8">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 p-4">
            <dt className="text-sm text-ink-400">{row.label}</dt>
            <dd className="flex items-center gap-3">
              <span
                className={cn(
                  'text-sm font-medium text-ink-50',
                  row.label === 'رقم الهاتف' && 'ltr-nums',
                )}
              >
                {row.value}
              </span>
              <button
                type="button"
                onClick={() => setStep(row.step)}
                className="grid size-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white/[0.06] hover:text-ink-100"
                aria-label={`تعديل ${row.label}`}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <Checkbox
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
        label="أؤكد أن البيانات المدخلة صحيحة."
      />

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[#FF8A9B]/25 bg-[#FF8A9B]/[0.08] px-4 py-3 text-sm leading-relaxed text-[#FFB3BF]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" size="lg" onClick={back} disabled={submitting}>
          رجوع
        </Button>
        <Button
          size="lg"
          fullWidth
          onClick={onSubmit}
          // Disabled until confirmed, and disabled while in flight — this is
          // what stops a double tap from firing two requests.
          disabled={!confirmed || submitting}
          loading={submitting}
          loadingLabel="جارٍ تأكيد الحجز…"
          className="sm:flex-1"
        >
          تأكيد الحجز
        </Button>
      </div>

      <p className="text-center text-xs text-ink-500">
        بتأكيد الحجز، أنت تثبّت جهازًا باسمك من الكمية المتاحة.
      </p>
    </div>
  );
}

// ─── Shared step chrome ──────────────────────────────────────────────────────

function StepShell({
  title,
  description,
  children,
  canContinue,
  onContinue,
  onBack,
  continueType = 'button',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  canContinue: boolean;
  onContinue?: () => void;
  onBack?: () => void;
  continueType?: 'button' | 'submit';
}) {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-display-sm font-semibold text-ink-50">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-ink-400">{description}</p>
        )}
      </header>

      {children}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {onBack && (
          <Button variant="secondary" size="lg" onClick={onBack}>
            رجوع
          </Button>
        )}
        <Button
          type={continueType}
          size="lg"
          fullWidth
          onClick={continueType === 'button' ? onContinue : undefined}
          disabled={!canContinue}
          className="sm:flex-1"
        >
          متابعة
        </Button>
      </div>
    </div>
  );
}
