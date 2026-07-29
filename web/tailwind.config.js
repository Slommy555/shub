/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      maxWidth: {
        app: '640px',
      },
      colors: {
        // A true neutral ramp — pure greys through to near-black, no color cast.
        // The whole app is built on `gray-*` utilities, so redefining the ramp
        // re-skins every screen at once (and keeps the custom-color remap in
        // index.css working, since that matches on class names). The only color
        // in the UI is the accent.
        gray: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e6e6e6',
          300: '#d4d4d4',
          400: '#a1a1a1',
          500: '#737373',
          600: '#525252',
          700: '#3f3f3f',
          800: '#272727',
          900: '#171717',
          950: '#0b0b0b',
        },
        // The single accent, used for active states, focus rings and primary
        // highlights. Every shade reads from a CSS variable holding an "R G B"
        // triple, so Settings → Accent color can re-tint the whole app at
        // runtime. Defaults (soft lavender, per UI_SKILL.md) live in index.css;
        // the <alpha-value> placeholder keeps `/60` opacity modifiers working.
        accent: {
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
        },
        /* Readable text/icon color on top of an accent fill. */
        accentfg: 'rgb(var(--accent-fg) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.05), 0 8px 24px -12px rgba(0, 0, 0, 0.14)',
        pop: '0 12px 40px -12px rgba(0, 0, 0, 0.38)',
        glow: '0 6px 20px -6px rgb(var(--accent-600) / 0.55)',
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'pop-in': 'pop-in 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
