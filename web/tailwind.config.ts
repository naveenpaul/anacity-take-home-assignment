import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Map CSS vars to Tailwind utilities so we can use bg-surface, text-primary, etc.
        surface: {
          DEFAULT: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          muted: 'var(--surface-muted)',
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        line: {
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        brand: {
          DEFAULT: 'var(--brand-primary)',
          soft: 'var(--brand-primary-soft)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      borderRadius: {
        // Override Tailwind defaults to enforce our scale.
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '4px', // intentionally same as md — refuse the bubble-radius default
        full: '9999px',
      },
      spacing: {
        // Standard scale; Tailwind's defaults already match closely.
      },
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
        lg: ['16px', '24px'],
        xl: ['18px', '26px'],
        '2xl': ['22px', '30px'],
        '3xl': ['28px', '36px'],
        '4xl': ['36px', '44px'],
        '5xl': ['48px', '56px'],
      },
    },
  },
  plugins: [],
};

export default config;
