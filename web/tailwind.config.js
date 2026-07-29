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
        // Refined neutral ramp — cool graphite with a faint violet undertone.
        // The whole app is built on `gray-*` utilities, so redefining the ramp
        // re-skins every screen at once (and keeps the custom-color remap in
        // index.css working, since that matches on class names).
        gray: {
          50: '#f8f8fb',
          100: '#f1f1f6',
          200: '#e4e4ee',
          300: '#ccccdb',
          400: '#9898ad',
          500: '#707086',
          600: '#56566b',
          700: '#414155',
          800: '#2a2a3a',
          900: '#191924',
          950: '#101017',
        },
        // Single accent — soft lavender (see UI_SKILL.md). Used sparingly for
        // active states, focus rings and primary highlights.
        accent: {
          50: '#f5f3ff',
          100: '#ede9ff',
          200: '#ddd6fe',
          300: '#c9bdfa',
          400: '#b8a9f5',
          500: '#9b88e8',
          600: '#7c6fb0',
          700: '#645a90',
          800: '#4a4370',
          900: '#332e52',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 16, 23, 0.04), 0 8px 24px -12px rgba(16, 16, 23, 0.12)',
        pop: '0 12px 40px -12px rgba(16, 16, 23, 0.35)',
        glow: '0 6px 20px -6px rgba(124, 111, 176, 0.55)',
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
