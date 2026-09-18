import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "Naturaleza & Abasto"
        fresco: {
          DEFAULT: '#10B981', // Emerald-500 — acción primaria / éxito
          fg: '#FFFFFF',
        },
        bosque: {
          DEFAULT: '#065F46', // Emerald-800 — navegación / headers
          fg: '#FFFFFF',
        },
        atencion: {
          DEFAULT: '#F97316', // Orange-500 — vida útil media / ofertas
          fg: '#FFFFFF',
        },
        alerta: {
          DEFAULT: '#EF4444', // Red-500 — mermas / descartes / alerta extrema
          fg: '#FFFFFF',
        },
        // Semáforo de frescura
        semaforo: {
          verde: '#10B981',
          amarillo: '#F97316',
          rojo: '#EF4444',
        },
        // shadcn/ui tokens (mapeados a variables CSS)
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.05), 0 6px 16px -6px rgb(15 23 42 / 0.10)',
        pop: '0 18px 40px -12px rgb(15 23 42 / 0.35)',
        glow: '0 10px 30px -10px rgb(16 185 129 / 0.55)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      minHeight: {
        touch: '56px', // Ergonomía: target táctil mínimo
      },
      minWidth: {
        touch: '56px',
      },
      fontSize: {
        // Tipografía grande para legibilidad bajo el sol
        'touch-lg': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
        'fade-in': 'fade-in 0.18s ease-out both',
        'slide-up': 'slide-up 0.22s ease-out both',
        'scale-in': 'scale-in 0.18s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
