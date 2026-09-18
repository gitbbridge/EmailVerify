/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#061a30',
          900: '#082340',
          800: '#0d3156',
          700: '#174a80',
        },
        safety: {
          orange: '#ff512f',
          blue: '#1457a8',
          green: '#0fa36b',
          amber: '#f59e0b',
          red: '#ef4444',
        },
      },
      boxShadow: {
        card: '0 10px 28px rgba(15, 23, 42, 0.06)',
        topbar: '0 1px 0 rgba(15, 23, 42, 0.08)',
        panel: '0 2px 8px rgba(48, 42, 89, 0.07)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
