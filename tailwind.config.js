/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--bg-page)',
          surface: 'var(--bg-surface)',
          'surface-elevated': 'var(--bg-surface-elevated)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          border: 'var(--border-color)',
          'focus-ring': 'var(--focus-ring)',
          primary: 'var(--primary)',
          'primary-hover': 'var(--primary-hover)',
          'primary-text': 'var(--primary-text)',
          marked: 'var(--color-marked)',
          'marked-text': 'var(--color-marked-text)',
          answered: 'var(--color-answered)',
          'answered-text': 'var(--color-answered-text)',
          unattempted: 'var(--color-unattempted)',
          'unattempted-text': 'var(--color-unattempted-text)',
          success: 'var(--color-success)',
          danger: 'var(--color-danger)',
        }
      },
      outlineOffset: {
        3: '3px',
      }
    },
  },
  plugins: [],
}
