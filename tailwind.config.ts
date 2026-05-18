import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Palette brand — RGB triplet via CSS variables così Tailwind può
      // applicare l'opacity modifier (es. bg-agesci-blue/10). I default
      // (sia hex sia triplet) vivono in src/app/globals.css (:root) e
      // vengono sovrascritti a runtime dallo <style> di getCmsBundle().
      colors: {
        'agesci-purple': {
          DEFAULT: 'rgb(var(--agesci-purple-rgb, 75 44 127) / <alpha-value>)',
          light: 'rgb(var(--agesci-purple-light-rgb, 107 76 159) / <alpha-value>)',
          dark: 'rgb(var(--agesci-purple-dark-rgb, 59 28 111) / <alpha-value>)',
        },
        'agesci-yellow': {
          DEFAULT: 'rgb(var(--agesci-yellow-rgb, 241 180 47) / <alpha-value>)',
          light: 'rgb(var(--agesci-yellow-light-rgb, 248 204 107) / <alpha-value>)',
          dark: 'rgb(var(--agesci-yellow-dark-rgb, 217 160 32) / <alpha-value>)',
        },
        'brand-cyan': 'rgb(var(--brand-cyan-rgb, 41 187 206) / <alpha-value>)',
        'brand-red': 'rgb(var(--brand-red-rgb, 233 78 90) / <alpha-value>)',
        'lc-green': {
          DEFAULT: 'rgb(var(--lc-green-rgb, 78 175 72) / <alpha-value>)',
          light: 'rgb(var(--lc-green-light-rgb, 107 201 99) / <alpha-value>)',
          dark: 'rgb(var(--lc-green-dark-rgb, 58 143 52) / <alpha-value>)',
        },
        'scout-cream': 'rgb(var(--scout-cream-rgb, 253 250 246) / <alpha-value>)',
        // Alias legacy (blue mappato a purple per transizione)
        'agesci-blue': {
          DEFAULT: 'rgb(var(--agesci-blue-rgb, 75 44 127) / <alpha-value>)',
          light: 'rgb(var(--agesci-blue-light-rgb, 107 76 159) / <alpha-value>)',
          dark: 'rgb(var(--agesci-blue-dark-rgb, 59 28 111) / <alpha-value>)',
        },
        // Colori legacy (non gestiti via CMS, restano statici)
        'scout-green': '#2D5016',
        'scout-green-light': '#4A7C23',
        'scout-azure': '#1E6091',
        'scout-azure-light': '#2E86C1',
        'scout-wood': '#8B4513',
        'scout-wood-light': '#A0522D',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-loveyou)', 'var(--font-quicksand)', 'system-ui', 'sans-serif'],
        brand: ['var(--font-dancing-script)', 'cursive'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      borderWidth: {
        '3': '3px',
      },
      // Box shadows — pilotabili via CSS vars override (--shadow-*).
      boxShadow: {
        'playful':    'var(--shadow-playful, 4px 4px 0 0 #4b2c7f)',
        'playful-sm': 'var(--shadow-playful-sm, 2px 2px 0 0 #4b2c7f)',
        'playful-lg': 'var(--shadow-playful-lg, 6px 6px 0 0 #4b2c7f)',
        'yellow':     'var(--shadow-yellow, 4px 4px 0 0 #f1b42f)',
        'yellow-sm':  'var(--shadow-yellow-sm, 2px 2px 0 0 #f1b42f)',
        'green':      'var(--shadow-green, 4px 4px 0 0 #4eaf48)',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bounce-soft': 'bounceSoft 0.5s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};

export default config;
