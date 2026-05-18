import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Palette brand — tutti i valori sono CSS variables con fallback hex.
      // I default sono in src/app/globals.css (:root) e possono essere
      // sovrascritti a runtime via <style> iniettato da getCmsBundle().
      colors: {
        'agesci-purple': {
          DEFAULT: 'var(--agesci-purple, #4b2c7f)',
          light: 'var(--agesci-purple-light, #6b4c9f)',
          dark: 'var(--agesci-purple-dark, #3b1c6f)',
        },
        'agesci-yellow': {
          DEFAULT: 'var(--agesci-yellow, #f1b42f)',
          light: 'var(--agesci-yellow-light, #f8cc6b)',
          dark: 'var(--agesci-yellow-dark, #d9a020)',
        },
        'brand-cyan': 'var(--brand-cyan, #29bbce)',
        'brand-red': 'var(--brand-red, #e94e5a)',
        'lc-green': {
          DEFAULT: 'var(--lc-green, #4eaf48)',
          light: 'var(--lc-green-light, #6bc963)',
          dark: 'var(--lc-green-dark, #3a8f34)',
        },
        'scout-cream': 'var(--scout-cream, #fdfaf6)',
        // Alias legacy (blue mappato a purple per transizione)
        'agesci-blue': {
          DEFAULT: 'var(--agesci-blue, #4b2c7f)',
          light: 'var(--agesci-blue-light, #6b4c9f)',
          dark: 'var(--agesci-blue-dark, #3b1c6f)',
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
