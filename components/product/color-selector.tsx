'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useSelectionStore, type SelectableColor } from '@/stores/selection-store';
import { DeviceVisual } from './device-visual';
import { cn } from '@/lib/utils';
import { motion as motionTokens } from '@/config/brand';

/**
 * Cinematic colour selector.
 *
 * Selecting a colour changes the product visual, the page lighting and the
 * accent colour together — the store writes CSS variables so the whole page
 * re-lights on the compositor rather than through a React re-render.
 *
 * Keyboard: this is a radio group, so arrow keys move between swatches and
 * only the selected one is a tab stop. That is the native pattern, and it is
 * what a screen-reader user expects here.
 */

interface ColorSelectorProps {
  colors: SelectableColor[];
  productName: string;
  heroImagePath: string | null;
}

export function ColorSelector({ colors, productName, heroImagePath }: ColorSelectorProps) {
  const reduceMotion = useReducedMotion();
  const { hydrate, select, selectedKey } = useSelectionStore();
  const selected = useSelectionStore((s) => s.selected());

  useEffect(() => {
    hydrate(colors);
  }, [colors, hydrate]);

  // Apply the initial tint once hydrated.
  useEffect(() => {
    if (selectedKey) select(selectedKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  if (colors.length === 0) return null;

  return (
    <section id="colors" className="scroll-mt-20 py-section" aria-labelledby="colors-title">
      <div className="shell">
        <header className="mb-12 max-w-prose">
          <p className="mb-3 text-sm font-medium text-burgundy-400">الألوان</p>
          <h2 id="colors-title" className="text-display-md font-semibold text-balance text-ink-50">
            أربعة ألوان. اختر ما يشبهك.
          </h2>
        </header>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative flex justify-center">
            <div
              className="product-glow pointer-events-none absolute inset-0 -z-10"
              aria-hidden="true"
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={selected?.key ?? 'none'}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 1.02 }}
                transition={{ duration: motionTokens.slow, ease: motionTokens.easeOut }}
                className="w-48 sm:w-64"
              >
                <DeviceVisual
                  src={selected?.imagePath ?? heroImagePath}
                  alt={`${productName} — ${selected?.nameAr ?? ''}`}
                  colorHex={selected?.hex ?? '#6B1F2E'}
                  sizes="(max-width: 640px) 50vw, 30vw"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div>
            <fieldset>
              <legend className="mb-5 text-sm font-medium text-ink-300">اختر اللون</legend>

              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="ألوان الجهاز">
                {colors.map((color) => {
                  const isSelected = color.key === selectedKey;
                  return (
                    <button
                      key={color.key}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      // Roving tabindex: one tab stop for the whole group.
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => select(color.key)}
                      onKeyDown={(event) => {
                        if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
                        event.preventDefault();
                        const index = colors.findIndex((c) => c.key === selectedKey);
                        // RTL: ArrowLeft moves forward through the list.
                        const delta = event.key === 'ArrowLeft' ? 1 : -1;
                        const next = colors[(index + delta + colors.length) % colors.length];
                        if (next) select(next.key);
                      }}
                      className={cn(
                        'group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300',
                        isSelected
                          ? 'border-white/25 bg-white/[0.08]'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/18 hover:bg-white/[0.05]',
                      )}
                    >
                      <span
                        className={cn(
                          'relative grid size-8 shrink-0 place-items-center rounded-full transition-transform duration-300',
                          isSelected && 'scale-105',
                        )}
                        style={{
                          background: `linear-gradient(140deg, ${color.gradientTo ?? color.hex}, ${color.hex} 55%, ${color.gradientFrom ?? color.hex})`,
                          boxShadow: isSelected
                            ? `0 0 0 2px rgba(255,255,255,0.85), 0 0 20px -2px ${color.hex}`
                            : 'inset 0 0 0 1px rgba(255,255,255,0.16)',
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          'text-sm font-medium transition-colors',
                          isSelected ? 'text-ink-50' : 'text-ink-300',
                        )}
                      >
                        {color.nameAr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <p className="mt-6 text-sm leading-relaxed text-ink-400">
              اللون المختار:{' '}
              <span className="font-medium text-ink-100">{selected?.nameAr}</span>
            </p>
            <p className="mt-2 text-xs text-ink-500">
              قد تختلف درجة اللون في الصور عن اللون الفعلي.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
