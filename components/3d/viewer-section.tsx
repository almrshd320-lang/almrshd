'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw, Box, Loader2 } from 'lucide-react';
import { useSelectionStore } from '@/stores/selection-store';
import { DevicePlaceholder } from '@/components/product/device-visual';
import { cn } from '@/lib/utils';

/**
 * 360° viewer.
 *
 * Everything here is about not paying for the 3D unless it will actually be
 * seen and can actually run:
 *
 *   • ssr:false + dynamic import  → three.js is not in the server bundle
 *   • IntersectionObserver        → nothing loads until the section is near
 *   • WebGL capability check      → old devices get the still image instead
 *   • prefers-reduced-motion      → no idle rotation, on-demand frameloop
 *   • error boundary              → a missing .glb degrades, it does not crash
 *
 * The result: the landing page's first load is unaffected by the existence of
 * this section, and the page stays fully functional when the model is absent —
 * which is the state it ships in.
 */

const ProductScene = dynamic(() => import('./product-scene'), {
  ssr: false,
  loading: () => <ViewerLoading />,
});

function ViewerLoading() {
  return (
    <div className="grid size-full place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-ink-400">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <p className="text-sm">جارٍ تحميل العرض ثلاثي الأبعاد…</p>
      </div>
    </div>
  );
}

/** Error boundary — the only place a class component is warranted. */
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    // A missing or malformed .glb is expected before Al-Murshid supplies one.
    console.warn('[3d] scene failed, falling back to the still image', error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ??
        canvas.getContext('webgl') ??
        canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

export function ViewerSection({ modelPath }: { modelPath: string | null }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [activated, setActivated] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const selected = useSelectionStore((s) => s.selected());
  const colorHex = selected?.hex ?? '#6B1F2E';

  useEffect(() => {
    setWebglOk(hasWebGl());

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      // Start warming up one viewport ahead, so it is ready on arrival.
      { rootMargin: '400px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const canRender3d = Boolean(modelPath) && webglOk && nearViewport;

  const fallback = (
    <div className="grid size-full place-items-center p-8">
      <div className="w-40 sm:w-52">
        <DevicePlaceholder colorHex={colorHex} label="صورة الجهاز" />
      </div>
    </div>
  );

  return (
    <section id="viewer" ref={sectionRef} className="scroll-mt-20 py-section" aria-labelledby="viewer-title">
      <div className="shell">
        <header className="mb-10 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">عرض 360°</p>
          <h2 id="viewer-title" className="text-display-md font-semibold text-balance text-ink-50">
            أدِر الجهاز واستكشفه من كل زاوية
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-400">
            اسحب للتدوير، وقرّب بإصبعين. يتغيّر العرض مع اللون الذي تختاره.
          </p>
        </header>

        <div
          className={cn(
            'surface relative aspect-square w-full overflow-hidden sm:aspect-[16/10]',
            'touch-pan-y', // vertical page scroll keeps working over the canvas
          )}
        >
          <div className="product-glow pointer-events-none absolute inset-0" aria-hidden="true" />

          {canRender3d && activated ? (
            <SceneBoundary fallback={fallback}>
              <ProductScene
                modelPath={modelPath!}
                colorHex={colorHex}
                reducedMotion={reducedMotion}
              />
            </SceneBoundary>
          ) : (
            <div className="relative grid size-full place-items-center">
              {fallback}

              {canRender3d && !activated && (
                // Explicit activation: downloading a multi-megabyte model
                // unprompted is not something to do to someone on mobile data.
                <button
                  type="button"
                  onClick={() => setActivated(true)}
                  className="absolute inset-x-0 bottom-6 mx-auto flex w-fit items-center gap-2 rounded-full border border-white/15 bg-ink-900/80 px-5 py-3 text-sm font-medium text-ink-50 backdrop-blur transition-colors hover:bg-ink-800"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  ابدأ العرض ثلاثي الأبعاد
                </button>
              )}

              {!modelPath && (
                <p className="absolute inset-x-0 bottom-6 mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-ink-400">
                  <Box className="size-3.5" aria-hidden="true" />
                  العرض ثلاثي الأبعاد سيتوفر قريبًا
                </p>
              )}

              {modelPath && !webglOk && (
                <p className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full border border-white/10 px-4 py-2 text-xs text-ink-400">
                  جهازك لا يدعم العرض ثلاثي الأبعاد — هذه صورة ثابتة للجهاز.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-ink-500">
          الصور والنماذج لأغراض العرض وقد تختلف عن المنتج النهائي.
        </p>
      </div>
    </section>
  );
}
