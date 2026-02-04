import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'scout-green': '#2D5016',
        'scout-green-light': '#4A7C23',
        'scout-azure': '#1E6091',
        'scout-azure-light': '#2E86C1',
        'scout-wood': '#8B4513',
        'scout-wood-light': '#A0522D',
        'scout-cream': '#F5F5DC',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
