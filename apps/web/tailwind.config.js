/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          700: '#1D4ED8',
        },
        bg: '#0B0F12',
        panel: '#121821',
        text: '#E6EAF2',
        muted: '#8A93A6',
      },
      borderRadius: {
        'brand': '12px',
        'brand-sm': '8px',
      },
      boxShadow: {
        'brand': '0 6px 24px rgba(0, 0, 0, 0.24)',
      },
    },
  },
  plugins: [],
};

