const colors = require('./src/theme/colors.json');

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
        ...Object.fromEntries(
          Object.entries(colors).map(([name, value]) => [
            name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
            value,
          ]),
        ),
        primary: colors.textPrimary,
        secondary: colors.textSecondary,
      },
    },
  },
  plugins: [],
};
