/**
 * Al-Murshid brand tokens.
 *
 * Deep burgundy, black, white and metallic silver. Restraint is the point:
 * the design should read as expensive, not flashy. Gradients are used sparingly
 * and only to suggest lighting on a product, never as decoration.
 */

export const brand = {
  name: { ar: 'المرشد', en: 'Al-Murshid' },

  /** Burgundy — the single accent colour. Used deliberately, never as a wash. */
  burgundy: {
    50: '#FBF3F5',
    100: '#F5E1E6',
    200: '#E8BFC9',
    300: '#D593A4',
    400: '#B85C74',
    500: '#8E2A3C',
    600: '#6B1F2E',
    700: '#551824',
    800: '#3B1119',
    900: '#2A0A11',
  },

  /** Near-black surfaces. Not pure #000 — that flattens product photography. */
  ink: {
    50: '#F7F7F8',
    100: '#EDEDEF',
    200: '#D6D7DA',
    300: '#AFB1B6',
    400: '#7C7F86',
    500: '#565961',
    600: '#3A3D42',
    700: '#26282C',
    800: '#16171A',
    900: '#0B0C0D',
  },

  /** Metallic silver, for hairline rules and secondary type. */
  silver: {
    light: '#EDEFF2',
    base: '#C9CCD1',
    dark: '#8B8F96',
  },

  status: {
    inStock: '#1E8E5A',
    limited: '#B4761A',
    soldOut: '#A32E3E',
  },
} as const;

/**
 * Motion durations, in milliseconds.
 * Interface transitions stay in the 200–600ms band; only the cinematic hero
 * reveal is allowed to run longer, and even that stays under a second.
 */
export const motion = {
  instant: 0.12,
  fast: 0.2,
  base: 0.32,
  slow: 0.5,
  cinematic: 0.85,
  /** A calm, slightly weighted ease. No overshoot, no bounce. */
  ease: [0.22, 0.61, 0.36, 1] as const,
  easeOut: [0.16, 1, 0.3, 1] as const,
} as const;

export type ColorKey = 'burgundy' | 'silver' | 'glacier-blue' | 'royal-black';
