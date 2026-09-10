'use client';

import { create } from 'zustand';

/**
 * Landing-page colour selection.
 *
 * Kept in a store rather than lifted state because the choice re-lights several
 * sections that are not siblings — hero glow, showcase image, viewer material,
 * accent colour. Passing a callback down four levels for that would be worse.
 */

export interface SelectableColor {
  id: string;
  key: string;
  nameAr: string;
  hex: string;
  gradientFrom: string | null;
  gradientTo: string | null;
  imagePath: string | null;
}

interface SelectionState {
  colors: SelectableColor[];
  selectedKey: string | null;
  hydrate: (colors: SelectableColor[]) => void;
  select: (key: string) => void;
  selected: () => SelectableColor | null;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  colors: [],
  selectedKey: null,

  hydrate: (colors) =>
    set((state) => ({
      colors,
      // Preserve an existing choice across re-hydration (e.g. a route change
      // back to the landing page); otherwise default to the first colour.
      selectedKey:
        state.selectedKey && colors.some((c) => c.key === state.selectedKey)
          ? state.selectedKey
          : (colors[0]?.key ?? null),
    })),

  select: (key) => {
    set({ selectedKey: key });

    // Re-tint the whole page. Writing to CSS variables rather than re-rendering
    // every section keeps the transition on the compositor.
    if (typeof document !== 'undefined') {
      const color = get().colors.find((c) => c.key === key);
      if (color) {
        const root = document.documentElement;
        root.style.setProperty('--accent', color.hex);
        root.style.setProperty('--accent-glow-from', color.gradientFrom ?? color.hex);
        root.style.setProperty('--accent-glow-to', color.gradientTo ?? color.hex);
      }
    }
  },

  selected: () => {
    const { colors, selectedKey } = get();
    return colors.find((c) => c.key === selectedKey) ?? colors[0] ?? null;
  },
}));
