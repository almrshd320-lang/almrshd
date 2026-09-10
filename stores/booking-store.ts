'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uuid } from '@/lib/utils';
import type { DeliveryMethod } from '@/types/domain';

/**
 * Booking wizard state.
 *
 * Persisted to sessionStorage so an accidental refresh mid-flow does not lose
 * the customer's progress. Two things are deliberately NOT in here: anything
 * about price (there is none to hold) and anything the server derives.
 *
 * The idempotency key is minted once per booking attempt and survives a retry,
 * which is what makes a double-submit return the first reservation instead of
 * consuming a second unit of stock.
 */

export type BookingStep = 'model' | 'capacity' | 'color' | 'delivery' | 'details' | 'review';

export const STEP_ORDER: BookingStep[] = [
  'model', 'capacity', 'color', 'delivery', 'details', 'review',
];

export const STEP_LABELS: Record<BookingStep, string> = {
  model: 'الطراز',
  capacity: 'السعة',
  color: 'اللون',
  delivery: 'الاستلام',
  details: 'بياناتك',
  review: 'المراجعة',
};

interface BookingState {
  step: BookingStep;

  productId: string | null;
  capacityId: string | null;
  colorId: string | null;
  variantId: string | null;

  deliveryMethod: DeliveryMethod | null;
  branchId: string | null;
  deliveryCity: string | null;

  fullName: string;
  phone: string;
  city: string;

  confirmed: boolean;
  idempotencyKey: string;

  setStep: (step: BookingStep) => void;
  next: () => void;
  back: () => void;

  selectProduct: (id: string) => void;
  selectCapacity: (id: string) => void;
  selectColor: (colorId: string, variantId: string) => void;
  setDelivery: (method: DeliveryMethod, branchId?: string, city?: string) => void;
  setDetails: (details: { fullName: string; phone: string; city: string }) => void;
  setConfirmed: (value: boolean) => void;

  /** Which steps have enough data to be considered done — drives the stepper. */
  completedSteps: () => Set<BookingStep>;
  canSubmit: () => boolean;
  reset: () => void;
  /** New attempt after a failure: fresh idempotency key, same selections. */
  renewAttempt: () => void;
}

const INITIAL = {
  step: 'model' as BookingStep,
  productId: null,
  capacityId: null,
  colorId: null,
  variantId: null,
  deliveryMethod: null,
  branchId: null,
  deliveryCity: null,
  fullName: '',
  phone: '',
  city: '',
  confirmed: false,
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      idempotencyKey: uuid(),

      setStep: (step) => set({ step }),

      next: () => {
        const index = STEP_ORDER.indexOf(get().step);
        const nextStep = STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
        if (nextStep) set({ step: nextStep });
      },

      back: () => {
        const index = STEP_ORDER.indexOf(get().step);
        const previous = STEP_ORDER[Math.max(index - 1, 0)];
        if (previous) set({ step: previous });
      },

      // Changing the model invalidates capacity and colour: the new model may
      // not offer the same combination, and a stale variantId would be a
      // reservation for the wrong device.
      selectProduct: (id) =>
        set((state) =>
          state.productId === id
            ? { productId: id }
            : { productId: id, capacityId: null, colorId: null, variantId: null },
        ),

      // Same reasoning one level down.
      selectCapacity: (id) =>
        set((state) =>
          state.capacityId === id
            ? { capacityId: id }
            : { capacityId: id, colorId: null, variantId: null },
        ),

      selectColor: (colorId, variantId) => set({ colorId, variantId }),

      setDelivery: (method, branchId, city) =>
        set({
          deliveryMethod: method,
          branchId: method === 'PICKUP' ? (branchId ?? null) : null,
          deliveryCity: method === 'DELIVERY' ? (city ?? null) : null,
        }),

      setDetails: ({ fullName, phone, city }) => set({ fullName, phone, city }),

      setConfirmed: (value) => set({ confirmed: value }),

      completedSteps: () => {
        const s = get();
        const done = new Set<BookingStep>();
        if (s.productId) done.add('model');
        if (s.capacityId) done.add('capacity');
        if (s.variantId) done.add('color');
        if (
          s.deliveryMethod === 'PICKUP'
            ? Boolean(s.branchId)
            : s.deliveryMethod === 'DELIVERY'
              ? Boolean(s.deliveryCity)
              : false
        ) {
          done.add('delivery');
        }
        if (s.fullName.length >= 3 && s.phone.length >= 9 && s.city.length >= 2) {
          done.add('details');
        }
        return done;
      },

      canSubmit: () => {
        const s = get();
        return (
          get().completedSteps().size === 5 && Boolean(s.variantId) && s.confirmed
        );
      },

      reset: () => set({ ...INITIAL, idempotencyKey: uuid() }),

      renewAttempt: () => set({ idempotencyKey: uuid() }),
    }),
    {
      name: 'almurshid-booking',
      storage: createJSONStorage(() => sessionStorage),
      // `step` is intentionally not persisted: returning to a half-finished
      // review screen after a refresh is disorienting, and the stepper can
      // rebuild the right position from the data.
      partialize: ({ step: _step, ...rest }) => rest,
    },
  ),
);
