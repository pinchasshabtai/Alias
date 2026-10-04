import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8E7',
        ink: '#1E1B4B',
        sun: '#FFC93C',
        tomato: '#FF5A5F',
        sky: '#2D7DFF',
        mint: '#22C55E',
        grape: '#8B5CF6',
        bubble: '#EC4899',
        tangerine: '#FF8A00',
      },
      fontFamily: {
        body: ['var(--font-rubik)', 'system-ui', 'sans-serif'],
        display: ['var(--font-secular)', 'var(--font-rubik)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 0 0 rgba(30,27,75,0.12), 0 14px 30px -12px rgba(30,27,75,0.25)',
        chunky: '0 8px 0 0 #1E1B4B',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '70%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        floatUp: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'translateY(-70px) scale(1.3)', opacity: '0' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        pulseFast: {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
        confetti: {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0.9' },
        },
      },
      animation: {
        pop: 'pop 0.35s ease-out both',
        slideIn: 'slideIn 0.3s ease-out both',
        floatUp: 'floatUp 0.9s ease-out forwards',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
        pulseFast: 'pulseFast 0.6s ease-in-out infinite',
        confetti: 'confetti 3.5s linear forwards',
      },
    },
  },
  plugins: [],
};

export default config;
