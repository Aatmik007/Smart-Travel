/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e1e9ff',
          200: '#cbd9ff',
          300: '#a3c0ff',
          400: '#759dff',
          500: '#3b6cfd', // JammuMove Primary Blue
          600: '#254deb',
          700: '#1d3ad8',
          850: '#0b132b', // Dark Navy
          900: '#070b19', // Deepest Navy
        },
        accent: {
          teal: '#06b6d4',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-light': '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
      }
    },
  },
  plugins: [],
}
