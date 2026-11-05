/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        palette: {
          deep: '#2E3A44',
          steel: '#4C5F6B',
          slate: '#7E939C',
          frost: '#B0C2C6',
          sage: '#DDE4E1',
          cream: '#F6F4EE',
        },
      },
      boxShadow: {
        'glass-card': '0 8px 32px 0 rgba(46, 58, 68, 0.35)',
        'glass-inset': 'inset 0 1px 1px 0 rgba(246, 244, 238, 0.15)',
        'glass-glow': '0 0 25px rgba(176, 194, 198, 0.25)',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
};

