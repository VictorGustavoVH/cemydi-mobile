/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
        inter: ['Inter_400Regular'],
      },
      colors: {
        background: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-muted': '#F8FAFC',
        brand: '#258e8b',
        'brand-strong': '#207a77',
        'brand-pressed': '#1b6f6c',
        'on-brand': '#FFFFFF',
        primary: '#0F172A',
        secondary: '#475569',
        border: '#CBD5E1',
        danger: '#B91C1C',
        'on-danger': '#FFFFFF',
        disabled: '#94A3B8',
        focus: '#258e8b',
      },
    },
  },
  plugins: [],
};
