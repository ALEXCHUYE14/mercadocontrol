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
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
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
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
