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
          DEFAULT: '#3182F6',
          hover: '#1B64DA',
          light: '#E8F3FF',
        },
        bg: '#F7F8FA',
        'bg-elevated': '#FFFFFF',
        panel: '#FFFFFF',
        text: '#191F28',
        'text-secondary': '#4E5968',
        muted: '#8B95A1',
        'text-tertiary': '#B0B8C1',
        border: '#E5E8EB',
        'border-light': '#F2F4F6',
      },
      borderRadius: {
        'brand': '16px',
        'brand-md': '12px',
        'brand-sm': '8px',
      },
      boxShadow: {
        'brand': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'brand-md': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'brand-lg': '0 8px 24px rgba(0, 0, 0, 0.08)',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont',
          'Pretendard Variable', 'Pretendard',
          'Noto Sans KR', 'system-ui', 'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

