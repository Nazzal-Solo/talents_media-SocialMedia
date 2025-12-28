/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Midnight Aura Theme Colors
        'tm-bg': '#020617',
        'tm-bg-alt': '#020b26',
        'tm-card': '#0b1120',
        'tm-card-soft': '#0f172a',
        'tm-border': '#1f2937',
        'tm-primary-from': '#ec4899', // pink
        'tm-primary-to': '#f97316', // amber
        'tm-secondary': '#22d3ee', // cyan
        'tm-text': '#e5e7eb',
        'tm-text-muted': '#9ca3af',
        'tm-text-strong': '#f9fafb',
        // Keep legacy colors for backward compatibility during migration
        'neon-purple': {
          50: '#f3f0ff',
          100: '#e9e3ff',
          200: '#d6ccff',
          300: '#b8a6ff',
          400: '#9575ff',
          500: '#7c5cfc',
          600: '#6d3ef7',
          700: '#5d2ae8',
          800: '#4c1fb8',
          900: '#3d1a8f',
        },
        'neon-magenta': {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#e91e63',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        'neon-cyan': {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#00e5ff',
          600: '#06b6d4',
          700: '#0891b2',
          800: '#0e7490',
          900: '#164e63',
        },
        'dark-bg': {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#bdc1c6',
          500: '#9aa0a6',
          600: '#80868b',
          700: '#5f6368',
          800: '#3c4043',
          900: '#202124',
          950: '#0b0a1f',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.05)',
          purple: 'rgba(124, 92, 252, 0.1)',
          magenta: 'rgba(233, 30, 99, 0.1)',
          cyan: 'rgba(0, 229, 255, 0.1)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'neon-gradient':
          'linear-gradient(135deg, #0b0a1f 0%, #160b35 50%, #2d1b69 100%)',
        'neon-glow': 'linear-gradient(45deg, #7c5cfc, #e91e63, #00e5ff)',
        'midnight-aura': 'radial-gradient(circle at top, #020b26, #020617)',
        'tm-primary-gradient': 'linear-gradient(to right, #ec4899, #f97316)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'neon-pulse': 'neon-pulse 2s ease-in-out infinite alternate',
        float: 'float 3s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        shimmer: 'shimmer 2s linear infinite',
        'bounce-select': 'bounce-select 0.4s ease-out',
        'glow-pulse': 'glow-pulse 0.6s ease-out',
      },
      keyframes: {
        'neon-pulse': {
          '0%': {
            boxShadow: '0 0 5px #7c5cfc, 0 0 10px #7c5cfc, 0 0 15px #7c5cfc',
            opacity: '1',
          },
          '100%': {
            boxShadow: '0 0 10px #7c5cfc, 0 0 20px #7c5cfc, 0 0 30px #7c5cfc',
            opacity: '0.8',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': {
            textShadow: '0 0 5px #7c5cfc, 0 0 10px #7c5cfc, 0 0 15px #7c5cfc',
            color: '#7c5cfc',
          },
          '100%': {
            textShadow: '0 0 10px #e91e63, 0 0 20px #e91e63, 0 0 30px #e91e63',
            color: '#e91e63',
          },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'bounce-select': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1.1)' },
        },
        'glow-pulse': {
          '0%': { 
            boxShadow: '0 0 0px rgba(124, 92, 252, 0.4)',
          },
          '50%': { 
            boxShadow: '0 0 12px rgba(124, 92, 252, 0.6), 0 0 20px rgba(34, 211, 238, 0.4)',
          },
          '100%': { 
            boxShadow: '0 0 8px rgba(124, 92, 252, 0.4)',
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        neon: '0 0 2px rgba(124, 92, 252, 0.3)',
        'neon-lg': '0 0 4px rgba(124, 92, 252, 0.4)',
        'neon-magenta': '0 0 2px rgba(233, 30, 99, 0.3)',
        'neon-cyan': '0 0 2px rgba(0, 229, 255, 0.3)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      },
    },
  },
  plugins: [],
};

