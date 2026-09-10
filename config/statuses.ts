import type { ReservationStatus, DeliveryMethod, Availability } from '@/types/domain';

/**
 * The single place where a status becomes Arabic text. Nothing else in the app
 * hard-codes these strings.
 */

interface StatusMeta {
  ar: string;
  description: string;
  /** Position in the customer-facing timeline; -1 = off the happy path. */
  step: number;
  tone: 'neutral' | 'progress' | 'success' | 'danger';
}

export const RESERVATION_STATUS: Record<ReservationStatus, StatusMeta> = {
  RECEIVED: {
    ar: 'تم استلام الطلب',
    description: 'وصلنا طلبك وهو الآن قيد المراجعة.',
    step: 0,
    tone: 'neutral',
  },
  CONFIRMED: {
    ar: 'تم تأكيد الحجز',
    description: 'تم تأكيد حجزك وحُجز لك الجهاز.',
    step: 1,
    tone: 'progress',
  },
  READY: {
    ar: 'الجهاز جاهز',
    description: 'جهازك جاهز للاستلام.',
    step: 2,
    tone: 'progress',
  },
  OUT_FOR_DELIVERY: {
    ar: 'قيد التوصيل',
    description: 'جهازك في الطريق إليك.',
    step: 3,
    tone: 'progress',
  },
  DELIVERED: {
    ar: 'تم التسليم',
    description: 'تم تسليم الجهاز. نتمنى لك تجربة ممتعة.',
    step: 4,
    tone: 'success',
  },
  CANCELLED: {
    ar: 'تم إلغاء الحجز',
    description: 'تم إلغاء هذا الحجز.',
    step: -1,
    tone: 'danger',
  },
  EXPIRED: {
    ar: 'انتهت صلاحية الحجز',
    description: 'انتهت مدة صلاحية الحجز ولم يعد ساريًا.',
    step: -1,
    tone: 'danger',
  },
};

/** The steps a customer sees, in order, for each delivery method. */
export const TIMELINE_STEPS: Record<DeliveryMethod, ReservationStatus[]> = {
  PICKUP: ['RECEIVED', 'CONFIRMED', 'READY', 'DELIVERED'],
  DELIVERY: ['RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'],
};

export const TERMINAL_STATUSES: ReservationStatus[] = ['DELIVERED', 'CANCELLED', 'EXPIRED'];

export const DELIVERY_METHOD: Record<DeliveryMethod, { ar: string; hint: string }> = {
  PICKUP: { ar: 'استلام من الفرع', hint: 'استلم جهازك من أقرب فرع لك.' },
  DELIVERY: { ar: 'توصيل', hint: 'نوصل الجهاز إلى مدينتك.' },
};

/**
 * Availability is communicated with an icon AND text, never colour alone —
 * a WCAG requirement and simply clearer.
 */
export const AVAILABILITY: Record<Availability, {
  ar: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  icon: 'check' | 'alert' | 'x';
  selectable: boolean;
}> = {
  IN_STOCK:    { ar: 'متوفر',        tone: 'success', icon: 'check', selectable: true },
  LIMITED:     { ar: 'كمية محدودة',  tone: 'warning', icon: 'alert', selectable: true },
  SOLD_OUT:    { ar: 'نفد',          tone: 'danger',  icon: 'x',     selectable: false },
  UNAVAILABLE: { ar: 'غير متاح',     tone: 'neutral', icon: 'x',     selectable: false },
};

/**
 * Error codes raised by the database, mapped to what the customer should read.
 * An unmapped code falls back to a generic message — we never surface raw SQL.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  BOOKING_CLOSED: 'الحجز غير متاح حاليًا.',
  'BOOKING_CLOSED:NOT_YET_OPEN': 'لم يبدأ الحجز بعد.',
  'BOOKING_CLOSED:DISABLED': 'الحجز مغلق حاليًا.',
  'BOOKING_CLOSED:MAINTENANCE': 'الحجوزات متوقفة مؤقتًا. نعود إليكم قريبًا.',
  'BOOKING_CLOSED:NOT_CONFIGURED': 'لم يُحدَّد موعد الحجز بعد.',
  OUT_OF_STOCK: 'نفدت الكمية من هذا الخيار. جرّب لونًا أو سعة أخرى.',
  INVALID_VARIANT: 'هذا الخيار غير متاح.',
  INVALID_PHONE: 'رقم الهاتف غير صحيح. مثال: 0912345678',
  INVALID_NAME: 'الاسم غير صحيح.',
  INVALID_CITY: 'المدينة غير صحيحة.',
  INVALID_BRANCH: 'الفرع المحدد غير متاح.',
  BRANCH_REQUIRED: 'يرجى اختيار الفرع.',
  INVALID_DELIVERY_CITY: 'يرجى إدخال مدينة التوصيل.',
  PICKUP_DISABLED: 'الاستلام من الفرع غير متاح حاليًا.',
  DELIVERY_DISABLED: 'التوصيل غير متاح حاليًا.',
  PRICE_NOT_SET: 'هذا الخيار غير متاح للحجز حاليًا.',
  RATE_LIMITED: 'محاولات كثيرة. يرجى المحاولة بعد قليل.',
  CODE_GENERATION_FAILED: 'تعذّر إنشاء الحجز. يرجى المحاولة مرة أخرى.',
  NOT_AUTHENTICATED: 'يجب تسجيل الدخول.',
  FORBIDDEN: 'ليس لديك صلاحية لهذا الإجراء.',
  RESERVATION_NOT_FOUND: 'لم يتم العثور على الحجز.',
  INVALID_TRANSITION: 'لا يمكن الانتقال إلى هذه الحالة.',
  NOT_TERMINAL: 'لا يمكن تنفيذ هذا الإجراء على حجز نشط.',
  WOULD_GO_NEGATIVE: 'الكمية الناتجة أقل من صفر.',
  INVALID_PRICE: 'قيمة السعر غير صحيحة.',
  INVALID_QUANTITY: 'قيمة الكمية غير صحيحة.',
  DEFAULT: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
};

/** Turns a raw database error into an Arabic message, prefix-matching on `:`. */
export function toArabicError(raw: string | null | undefined): string {
  if (!raw) return ERROR_MESSAGES.DEFAULT!;
  const trimmed = raw.trim();
  if (ERROR_MESSAGES[trimmed]) return ERROR_MESSAGES[trimmed]!;
  const base = trimmed.split(':')[0];
  if (base && ERROR_MESSAGES[base]) return ERROR_MESSAGES[base]!;
  return ERROR_MESSAGES.DEFAULT!;
}
