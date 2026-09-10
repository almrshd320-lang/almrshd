'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, Keyboard } from 'lucide-react';
import { validateQrAction } from '@/lib/admin/actions';
import { InlineError } from '@/components/ui/states';
import { RESERVATION_STATUS } from '@/config/statuses';
import { cn } from '@/lib/utils';
import type { QrScanResult, ReservationStatus, PublicBranch } from '@/types/domain';

/**
 * Counter scanner.
 *
 * Validation is entirely server-side — this component only captures a string
 * and shows what the server decided. Everything that matters (does the token
 * match, is the reservation collectable, has this code already been used) is
 * decided inside admin_validate_qr() under a row lock, and every attempt is
 * recorded in qr_scans whether it succeeds or fails.
 *
 * Camera capture uses the platform BarcodeDetector where available. Manual
 * entry is always present and is the primary path: it covers browsers without
 * BarcodeDetector (Safari today), USB scanners that type the payload, and the
 * customer who arrives with a screenshot that will not focus.
 */

const RESULT_META: Record<QrScanResult, {
  title: string;
  tone: 'good' | 'bad' | 'warn';
  Icon: typeof CheckCircle2;
}> = {
  VALID: { title: 'رمز صالح — يمكن التسليم', tone: 'good', Icon: CheckCircle2 },
  ALREADY_USED: { title: 'تم استخدام رمز QR مسبقًا', tone: 'bad', Icon: XCircle },
  INVALID: { title: 'رمز QR غير صالح', tone: 'bad', Icon: XCircle },
  NOT_ELIGIBLE: { title: 'الحجز غير جاهز للاستلام بعد', tone: 'warn', Icon: AlertTriangle },
};

interface ScanOutcome {
  result: QrScanResult;
  code?: string;
  status?: string;
}

export function QrScanner({ branches }: { branches: PublicBranch[] }) {
  const [isPending, startTransition] = useTransition();
  const [manual, setManual] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Prevents the detector loop from firing the same code dozens of times a
  // second while the camera stays pointed at it.
  const lastScanRef = useRef<string>('');

  useEffect(() => {
    setCameraSupported(
      typeof window !== 'undefined' &&
        'BarcodeDetector' in window &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  const submit = (payload: string) => {
    if (!payload.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await validateQrAction({
        payload: payload.trim(),
        branchId: branchId || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOutcome(result.data);
      setManual('');
    });
  };

  const stopCamera = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraOn(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const DetectorCtor = (
        window as unknown as {
          BarcodeDetector: new (options: { formats: string[] }) => {
            detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
          };
        }
      ).BarcodeDetector;

      const detector = new DetectorCtor({ formats: ['qr_code'] });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue;
          if (value && value !== lastScanRef.current) {
            lastScanRef.current = value;
            submit(value);
            // Let the operator read the result before scanning again.
            setTimeout(() => {
              lastScanRef.current = '';
            }, 2500);
          }
        } catch {
          // A transient decode failure is normal between frames.
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };

      rafRef.current = requestAnimationFrame(() => void tick());
    } catch {
      setError('تعذّر الوصول إلى الكاميرا. استخدم الإدخال اليدوي.');
      stopCamera();
    }
  };

  // Release the camera when the operator navigates away.
  useEffect(() => stopCamera, []);

  const meta = outcome ? RESULT_META[outcome.result] : null;

  return (
    <div className="space-y-5">
      {branches.length > 1 && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <label htmlFor="branch" className="mb-1.5 block text-sm font-medium text-ink-700">
            الفرع
          </label>
          <select
            id="branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="h-11 w-full rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.nameAr}
              </option>
            ))}
          </select>
        </div>
      )}

      {meta && outcome && (
        <div
          role="status"
          aria-live="assertive"
          className={cn(
            'flex items-start gap-3 rounded-xl border px-5 py-4',
            meta.tone === 'good' && 'border-[#B6E2CC] bg-[#E3F5EC]',
            meta.tone === 'bad' && 'border-[#F0C4CC] bg-[#FBE9EC]',
            meta.tone === 'warn' && 'border-[#F0DDB6] bg-[#FBF3E3]',
          )}
        >
          <meta.Icon
            className={cn(
              'mt-0.5 size-5 shrink-0',
              meta.tone === 'good' && 'text-[#12613C]',
              meta.tone === 'bad' && 'text-[#8E2434]',
              meta.tone === 'warn' && 'text-[#8A5A12]',
            )}
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold text-ink-800">{meta.title}</p>
            {outcome.code && (
              <p className="ltr-nums mt-1 font-mono text-sm text-ink-600">{outcome.code}</p>
            )}
            {outcome.status && (
              <p className="mt-0.5 text-xs text-ink-500">
                حالة الحجز: {RESERVATION_STATUS[outcome.status as ReservationStatus]?.ar ?? outcome.status}
              </p>
            )}
          </div>
        </div>
      )}

      {error && <InlineError message={error} />}

      <div className="rounded-xl border border-ink-200 bg-white p-5">
        {cameraSupported ? (
          <>
            <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl bg-ink-900 sm:aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className={cn('size-full object-cover', !cameraOn && 'hidden')}
              />
              {!cameraOn && (
                <div className="grid size-full place-items-center text-ink-400">
                  <Camera className="size-8" aria-hidden="true" />
                </div>
              )}
              {cameraOn && (
                <div
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                  aria-hidden="true"
                >
                  <div className="size-48 rounded-2xl border-2 border-white/70" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => (cameraOn ? stopCamera() : void startCamera())}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-ink-300 px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
            >
              {cameraOn ? (
                <>
                  <CameraOff className="size-4" aria-hidden="true" />
                  إيقاف الكاميرا
                </>
              ) : (
                <>
                  <Camera className="size-4" aria-hidden="true" />
                  تشغيل الكاميرا
                </>
              )}
            </button>
          </>
        ) : (
          <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2.5 text-xs leading-relaxed text-ink-500">
            هذا المتصفح لا يدعم قراءة الرموز بالكاميرا. استخدم الإدخال اليدوي أدناه، أو
            قارئ QR متصل بالجهاز.
          </p>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(manual);
        }}
        className="rounded-xl border border-ink-200 bg-white p-5"
      >
        <label htmlFor="payload" className="mb-1.5 block text-sm font-medium text-ink-700">
          <span className="inline-flex items-center gap-1.5">
            <Keyboard className="size-4" aria-hidden="true" />
            إدخال يدوي
          </span>
        </label>
        <input
          id="payload"
          dir="ltr"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="MRSH1:MRSH-8K4P2X:…"
          // A USB scanner "types" the payload then presses Enter, which
          // submits this form — no extra integration needed.
          autoComplete="off"
          className="h-12 w-full rounded-lg border border-ink-300 px-4 text-left font-mono text-sm text-ink-800 focus:border-burgundy-500 focus:outline-none"
        />
        <p className="mt-2 text-xs text-ink-400">
          الصق محتوى الرمز أو استخدم قارئ QR متصل بالجهاز.
        </p>

        <button
          type="submit"
          disabled={isPending || !manual.trim()}
          className="mt-4 h-11 rounded-lg bg-burgundy-600 px-5 text-sm font-medium text-white transition-colors hover:bg-burgundy-500 disabled:opacity-50"
        >
          {isPending ? 'جارٍ التحقق…' : 'تحقق'}
        </button>
      </form>
    </div>
  );
}
