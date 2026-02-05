import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Palette AGESCI + Branca L/C
      colors: {
        // Colori principali AGESCI
        'agesci-blue': {
          DEFAULT: '#00417b',
          light: '#1a5a9e',
          dark: '#002d54',
        },
        'agesci-yellow': {
          DEFAULT: '#ffde00',
          light: '#fff066',
          dark: '#e6c800',
        },
        // Verde Branca L/C (Lupetti/Coccinelle)
        'lc-green': {
          DEFAULT: '#4eaf48',
          light: '#6bc963',
          dark: '#3a8f34',
        },
        // Sfondo "quaderno di caccia"
        'scout-cream': '#fdfaf0',
        // Colori legacy (per compatibilità)
        'scout-green': '#2D5016',
        'scout-green-light': '#4A7C23',
        'scout-azure': '#1E6091',
        'scout-azure-light': '#2E86C1',
        'scout-wood': '#8B4513',
        'scout-wood-light': '#A0522D',
      },
      // Font families
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-quicksand)', 'system-ui', 'sans-serif'],
      },
      // Border radius arrotondati "playful"
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      // Bordi spessi per card
      borderWidth: {
        '3': '3px',
      },
      // Ombre colorate "pop"
      boxShadow: {
        'playful': '4px 4px 0 0 #00417b',
        'playful-sm': '2px 2px 0 0 #00417b',
        'playful-lg': '6px 6px 0 0 #00417b',
        'yellow': '4px 4px 0 0 #ffde00',
        'yellow-sm': '2px 2px 0 0 #ffde00',
        'green': '4px 4px 0 0 #4eaf48',
      },
      // Animazioni fluide
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
      // Transizioni
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};

export default config;
