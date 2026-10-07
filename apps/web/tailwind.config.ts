import type { Config } from 'tailwindcss';
import fluid, { extract, fontSize, screens } from 'fluid-tailwind';
import tailwindAnimate from 'tailwindcss-animate';

const config: Config = {
  content: {
    files: [
      './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
      './src/components/**/*.{js,ts,jsx,tsx,mdx}',
      './src/app/**/*.{js,ts,jsx,tsx,mdx}',
      './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    extract,
  },
  darkMode: 'class',
  // Tailwind 3's hover variant otherwise sticks after tapping a control on touch.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    screens,
    fontSize,
    extend: {
      fontFamily: {
        sans: ['var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // RGB channels allow Tailwind 3 opacity modifiers (bg-surface/70, etc.).
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        edge: 'rgb(var(--edge-rgb) / <alpha-value>)',
        muted: 'rgb(var(--muted-rgb) / <alpha-value>)',
        signal: 'rgb(var(--signal-rgb) / <alpha-value>)',
        comparison: 'rgb(var(--comparison-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        error: 'rgb(var(--error-rgb) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--signal-rgb) / <alpha-value>)',
          hover: 'rgb(var(--signal-hover-rgb) / <alpha-value>)',
          subtle: 'var(--signal-subtle)',
        },
      },
      transitionTimingFunction: {
        'ease-out-custom': 'var(--ease-out)',
        'ease-in-out-custom': 'var(--ease-in-out)',
        'drawer-custom': 'var(--ease-drawer)',
      },
    },
  },
  plugins: [tailwindAnimate, fluid],
};

export default config;
