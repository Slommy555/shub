/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        elevated: 'var(--color-bg-elevated)',
        subtle: 'var(--color-bg-subtle)',
        line: 'var(--color-border)',
        'line-muted': 'var(--color-border-muted)',
        ink: 'var(--color-text-primary)',
        'ink-2': 'var(--color-text-secondary)',
        'ink-3': 'var(--color-text-tertiary)',
        gold: 'var(--color-accent)',
        'gold-dim': 'var(--color-accent-dim)',
        'gold-border': 'var(--color-accent-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
        set: '8px',
        input: '10px',
      },
    },
  },
  plugins: [],
}
