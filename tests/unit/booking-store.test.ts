import { describe, it, expect, beforeEach } from 'vitest';
import { useBookingStore } from '@/stores/booking-store';

/**
 * Booking store.
 *
 * The invalidation rules matter more than they look: a stale variantId left
 * behind after the customer changes model would reserve the wrong device, and
 * the server would happily accept it because the id is valid — just not for
 * what the customer now thinks they are buying.
 */

const VARIANT = '11111111-1111-4111-8111-111111111111';

describe('useBookingStore', () => {
  beforeEach(() => {
    useBookingStore.getState().reset();
  });

  it('starts at the first step with nothing chosen', () => {
    const state = useBookingStore.getState();
    expect(state.step).toBe('model');
    expect(state.productId).toBeNull();
    expect(state.completedSteps().size).toBe(0);
  });

  it('clears capacity and colour when the model changes', () => {
    const store = useBookingStore.getState();
    store.selectProduct('product-a');
    store.selectCapacity('capacity-1');
    store.selectColor('color-1', VARIANT);

    expect(useBookingStore.getState().variantId).toBe(VARIANT);

    useBookingStore.getState().selectProduct('product-b');

    const after = useBookingStore.getState();
    expect(after.capacityId).toBeNull();
    expect(after.colorId).toBeNull();
    expect(after.variantId).toBeNull();
  });

  it('keeps the selection when the same model is re-chosen', () => {
    const store = useBookingStore.getState();
    store.selectProduct('product-a');
    store.selectCapacity('capacity-1');
    store.selectColor('color-1', VARIANT);

    useBookingStore.getState().selectProduct('product-a');
    expect(useBookingStore.getState().variantId).toBe(VARIANT);
  });

  it('clears the colour when the capacity changes', () => {
    const store = useBookingStore.getState();
    store.selectProduct('product-a');
    store.selectCapacity('capacity-1');
    store.selectColor('color-1', VARIANT);

    useBookingStore.getState().selectCapacity('capacity-2');
    expect(useBookingStore.getState().colorId).toBeNull();
    expect(useBookingStore.getState().variantId).toBeNull();
  });

  it('drops the branch when switching to delivery, and the city when switching back', () => {
    const store = useBookingStore.getState();

    store.setDelivery('PICKUP', 'branch-1');
    expect(useBookingStore.getState().branchId).toBe('branch-1');

    useBookingStore.getState().setDelivery('DELIVERY', undefined, 'بنغازي');
    expect(useBookingStore.getState().branchId).toBeNull();
    expect(useBookingStore.getState().deliveryCity).toBe('بنغازي');

    useBookingStore.getState().setDelivery('PICKUP', 'branch-2');
    expect(useBookingStore.getState().deliveryCity).toBeNull();
  });

  it('refuses to submit until every step and the confirmation are done', () => {
    const store = useBookingStore.getState();
    store.selectProduct('product-a');
    store.selectCapacity('capacity-1');
    store.selectColor('color-1', VARIANT);
    store.setDelivery('PICKUP', 'branch-1');
    store.setDetails({ fullName: 'محمد علي', phone: '218912345678', city: 'طرابلس' });

    // Everything chosen, but the confirmation box is unticked.
    expect(useBookingStore.getState().canSubmit()).toBe(false);

    useBookingStore.getState().setConfirmed(true);
    expect(useBookingStore.getState().canSubmit()).toBe(true);
  });

  it('keeps one idempotency key across a whole attempt', () => {
    const first = useBookingStore.getState().idempotencyKey;
    useBookingStore.getState().selectProduct('product-a');
    useBookingStore.getState().next();
    // A retried submit must reuse this key so the server returns the original
    // reservation instead of consuming a second unit of stock.
    expect(useBookingStore.getState().idempotencyKey).toBe(first);
  });

  it('mints a new key for a deliberate new attempt', () => {
    const first = useBookingStore.getState().idempotencyKey;
    useBookingStore.getState().renewAttempt();
    expect(useBookingStore.getState().idempotencyKey).not.toBe(first);
  });

  it('mints a new key on reset', () => {
    const first = useBookingStore.getState().idempotencyKey;
    useBookingStore.getState().reset();
    expect(useBookingStore.getState().idempotencyKey).not.toBe(first);
  });

  it('never holds a price field', () => {
    const state = JSON.stringify(useBookingStore.getState());
    expect(state.toLowerCase()).not.toContain('price');
  });
});
