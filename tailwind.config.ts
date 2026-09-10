import type { Config } from 'tailwindcss';
import { brand } from './config/brand';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        burgundy: brand.burgundy,
        ink: brand.ink,
        silver: brand.silver,
        stock: {
          in: brand.status.inStock,
          limited: brand.status.limited,
          out: brand.status.soldOut,
        },
      },
      fontFamily: {
        // Bound to the CSS variable set by next/font in app/layout.tsx.
        sans: ['var(--font-arabic)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // A restrained display scale. Arabic type needs more leading than Latin
        // at the same size, so line-heights here are generous on purpose.
        'display-xl': ['clamp(2.75rem, 9vw, 6.5rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2.25rem, 6vw, 4.25rem)', { lineHeight: '1.14', letterSpacing: '-0.015em' }],
        'display-md': ['clamp(1.75rem, 4vw, 2.75rem)', { lineHeight: '1.25' }],
        'display-sm': ['clamp(1.375rem, 3vw, 1.875rem)', { lineHeight: '1.35' }],
      },
      spacing: {
        section: 'clamp(4rem, 10vw, 9rem)',
      },
      maxWidth: {
        shell: '80rem',
        prose: '42rem',
      },
      boxShadow: {
        // One soft elevation and one product-lighting glow. No neon.
        elevated: '0 1px 2px rgba(11,12,13,0.06), 0 12px 32px -12px rgba(11,12,13,0.22)',
        product: '0 60px 120px -40px rgba(0,0,0,0.65)',
        'inset-hairline': 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        // RTL: the shimmer travels right-to-left, matching the reading direction.
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
