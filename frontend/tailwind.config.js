/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          text: 'var(--accent-text)',
        },
        // Semantic aliases for the theme's CSS variables.
        default: 'var(--text)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        elevated: 'var(--bg-elevated)',
        background: 'var(--bg)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        glass: 'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      // Keep the shell grid tidy without magic numbers.
      spacing: {
        'now-playing': '5.5rem',
        sidebar: '15.5rem',
      },
    },
  },
  plugins: [],
};