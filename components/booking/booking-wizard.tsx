'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import {
  StepModel, StepCapacity, StepColor, StepDelivery, StepDetails, StepReview,
} from './steps';
import { useBookingStore, STEP_ORDER, STEP_LABELS, type BookingStep } from '@/stores/booking-store';
import { createReservationAction } from '@/lib/reservations/actions';
import { ErrorState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { routes } from '@/config/site';
import type { CatalogTree } from '@/lib/catalog';
import type { PublicBranch, PublicSettings, BookingWindow } from '@/types/domain';

/**
 * Booking wizard.
 *
 * Orchestration only: each step owns its own inputs, the store owns the
 * selections, and the server owns every decision that matters. When the customer
 * confirms, one Server Action call does the whole thing atomically — there is no
 * multi-request "create then reserve" sequence that could half-complete.
 */

interface WizardProps {
  tree: CatalogTree;
  branches: PublicBranch[];
  settings: PublicSettings;
  bookingWindow: BookingWindow;
}

export function BookingWizard({ tree, branches, settings, bookingWindow }: WizardProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Guards against a second submit slipping through between the click and
  // React flushing the pending state.
  const submittingRef = useRef(false);

  const store = useBookingStore();
  const { step, setStep, completedSteps, reset, renewAttempt } = store;

  // Zustand's sessionStorage rehydration happens after mount; rendering the
  // wizard before it lands would flash step 1 over a restored selection.
  useEffect(() => setHydrated(true), []);

  // Resume where the customer left off after a refresh.
  useEffect(() => {
    if (!hydrated) return;
    const done = completedSteps();
    const firstIncomplete = STEP_ORDER.find((s) => s !== 'review' && !done.has(s));
    setStep(firstIncomplete ?? 'review');
    // Runs once, deliberately: this is a resume, not a live sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // The window can close while the customer is mid-flow (maintenance mode, or
  // simply a long-open tab). The server would refuse anyway; say so up front.
  if (!bookingWindow.isOpen) {
    return (
      <ErrorState
        title={
          bookingWindow.reason === 'MAINTENANCE'
            ? 'الحجوزات متوقفة مؤقتًا'
            : bookingWindow.reason === 'NOT_YET_OPEN'
              ? 'لم يبدأ الحجز بعد'
              : 'الحجز غير متاح حاليًا'
        }
        description={
          bookingWindow.reason === 'MAINTENANCE'
            ? settings.maintenanceMessageAr
            : 'يمكنك متابعة الصفحة الرئيسية لمعرفة موعد فتح الحجز.'
        }
        action={
          <Button variant="secondary" onClick={() => router.push(routes.home)}>
            العودة للرئيسية
          </Button>
        }
      />
    );
  }

  if (!hydrated) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-20 w-full" />
      </div>
    );
  }

  const handleSubmit = () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);

    startTransition(async () => {
      try {
        const result = await createReservationAction({
          variantId: store.variantId,
          fullName: store.fullName,
          phone: store.phone,
          city: store.city,
          confirmed: true,
          idempotencyKey: store.idempotencyKey,
          ...(store.deliveryMethod === 'PICKUP'
            ? { deliveryMethod: 'PICKUP' as const, branchId: store.branchId }
            : { deliveryMethod: 'DELIVERY' as const, deliveryCity: store.deliveryCity }),
        });

        if (!result.ok) {
          setError(result.error);

          // Out of stock while they were filling the form: send them back to
          // pick another colour rather than leaving them on a dead review page.
          if (result.code === 'OUT_OF_STOCK') {
            setStep('color');
            renewAttempt();
          }
          return;
        }

        const { code, accessToken } = result.data;
        reset();

        // The raw token goes in the URL fragment, not the query string: it is
        // then never sent to the server in a request line and stays out of
        // access logs, referrers and browser history sync.
        router.push(
          accessToken
            ? `${routes.reservation(code)}#t=${encodeURIComponent(accessToken)}`
            : routes.track,
        );
      } catch (err) {
        console.error('[booking] submit failed', err);
        setError('تعذّر إتمام الحجز. تحقق من اتصالك وحاول مرة أخرى.');
      } finally {
        submittingRef.current = false;
      }
    });
  };

  const stepProps = { tree, branches, settings };

  return (
    <div className="space-y-8">
      <Stepper current={step} completed={completedSteps()} onJump={setStep} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {step === 'model' && <StepModel {...stepProps} />}
          {step === 'capacity' && <StepCapacity {...stepProps} />}
          {step === 'color' && <StepColor {...stepProps} />}
          {step === 'delivery' && <StepDelivery {...stepProps} />}
          {step === 'details' && <StepDetails {...stepProps} />}
          {step === 'review' && (
            <StepReview
              {...stepProps}
              submitting={isPending}
              error={error}
              onSubmit={handleSubmit}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Progress indicator.
 *
 * A completed step is clickable so the customer can go back and change
 * something without walking the whole flow again. Future steps are not: jumping
 * ahead past an unmade choice produces an incoherent review screen.
 */
function Stepper({
  current,
  completed,
  onJump,
}: {
  current: BookingStep;
  completed: Set<BookingStep>;
  onJump: (step: BookingStep) => void;
}) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <nav aria-label="مراحل الحجز">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 scroll-x">
        {STEP_ORDER.map((stepKey, index) => {
          const isDone = completed.has(stepKey);
          const isCurrent = stepKey === current;
          const reachable = isDone || index <= currentIndex;

          return (
            <li key={stepKey} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => reachable && onJump(stepKey)}
                disabled={!reachable}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                  isCurrent && 'bg-white/[0.08] text-ink-50',
                  !isCurrent && reachable && 'text-ink-300 hover:bg-white/[0.05]',
                  !reachable && 'cursor-default text-ink-600',
                )}
              >
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem]',
                    isDone && 'bg-burgundy-500 text-white',
                    !isDone && isCurrent && 'border border-burgundy-400 text-burgundy-300',
                    !isDone && !isCurrent && 'border border-white/15',
                  )}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="size-3" /> : index + 1}
                </span>
                {STEP_LABELS[stepKey]}
              </button>

              {index < STEP_ORDER.length - 1 && (
                <span
                  className={cn('mx-0.5 h-px w-4', isDone ? 'bg-burgundy-500/60' : 'bg-white/10')}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
