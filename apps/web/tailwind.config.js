/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './lib/**/*.{ts,tsx,js,jsx}',
    '../../libs/ui/src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        headline: ['var(--font-display)'],
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        sans: ['var(--font-body)'],
        label: ['var(--font-body)'],
        ethiopic: ['var(--font-ethiopic)'],
        'ethiopic-sans': ['var(--font-ethiopic-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          container: 'hsl(var(--primary-container))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          container: 'hsl(var(--secondary-container))',
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
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        'surface-container': 'hsl(var(--surface-container))',
        'surface-container-low': 'hsl(var(--surface-container-low))',
        'surface-container-high': 'hsl(var(--surface-container-high))',
        'outline-variant': 'hsl(var(--outline-variant))',

        /* Design-system palette. Values live in global.css as
           CSS variables so dark mode can switch them. */
        brand: {
          DEFAULT: 'rgb(var(--fy-brand) / <alpha-value>)',
          soft: 'rgb(var(--fy-brand-soft) / <alpha-value>)',
          mid: 'rgb(var(--fy-brand-mid) / <alpha-value>)',
          deep: 'rgb(var(--fy-brand-deep) / <alpha-value>)',
          ink: 'rgb(var(--fy-brand-ink) / <alpha-value>)', /* strongest text: teal-black, gold-cream in dark mode */
        },
        gold: {
          DEFAULT: 'rgb(var(--fy-gold) / <alpha-value>)',
          deep: 'rgb(var(--fy-gold-deep) / <alpha-value>)', /* gold used as text */
          light: 'rgb(var(--fy-gold-light) / <alpha-value>)',
          faint: 'rgb(var(--fy-gold-faint) / <alpha-value>)',
        },
        parchment: {
          DEFAULT: 'rgb(var(--fy-page) / <alpha-value>)',
          soft: 'rgb(var(--fy-card) / <alpha-value>)',
          deep: 'rgb(var(--fy-sunken) / <alpha-value>)',
          edge: 'rgb(var(--fy-edge) / <alpha-value>)',
          'edge-strong': 'rgb(var(--fy-edge-strong) / <alpha-value>)',
        },
        cream: {
          DEFAULT: 'rgb(var(--fy-cream) / <alpha-value>)',
          dim: 'rgb(var(--fy-cream) / 0.72)',
        },
        ink: {
          DEFAULT: 'rgb(var(--fy-ink) / <alpha-value>)',
          muted: 'rgb(var(--fy-ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--fy-ink-faint) / <alpha-value>)',
        },
        status: {
          present: 'rgb(var(--fy-present) / <alpha-value>)',
          'present-bg': 'rgb(var(--fy-present-bg) / <alpha-value>)',
          absent: 'rgb(var(--fy-absent) / <alpha-value>)',
          'absent-bg': 'rgb(var(--fy-absent-bg) / <alpha-value>)',
          late: 'rgb(var(--fy-late) / <alpha-value>)',
          'late-bg': 'rgb(var(--fy-late-bg) / <alpha-value>)',
        },
        /* Pre-member (ቅድመ አባል) accent: badge, QR card band */
        pre: {
          DEFAULT: 'rgb(var(--fy-pre) / <alpha-value>)',
          mid: 'rgb(var(--fy-pre-mid) / <alpha-value>)',
          deep: 'rgb(var(--fy-pre-deep) / <alpha-value>)',
          bg: 'rgb(var(--fy-pre-bg) / <alpha-value>)',
        },
      },
      borderRadius: {
        /* Reserved, consistent scale — driven by the --radius-* tokens in
           global.css. Change roundedness there, not per-component. */
        none: '0px',
        sm: 'var(--radius-sm)', /* 4px  — tags, chips */
        DEFAULT: 'var(--radius-md)', /* 8px  — controls */
        md: 'var(--radius-md)', /* 8px  — buttons, controls */
        lg: 'var(--radius-lg)', /* 10px — cards, panels */
        xl: 'var(--radius-xl)', /* 14px — CTAs, larger cards */
        '2xl': 'var(--radius-2xl)', /* 16px — feature cards */
        '3xl': 'var(--radius-3xl)', /* 20px — hero banners */
        full: '9999px',
        arch: '200px 200px 0 0', /* arched top for hero panels */
      },
      boxShadow: {
        'fy-sm': '0 1px 0 rgba(74, 14, 24, 0.04), 0 1px 2px rgba(74, 14, 24, 0.06)',
        'fy-md': '0 4px 16px -4px rgba(74, 14, 24, 0.10), 0 2px 4px rgba(74, 14, 24, 0.06)',
        'fy-lg': '0 16px 40px -16px rgba(74, 14, 24, 0.28), 0 4px 8px rgba(74, 14, 24, 0.06)',
        'fy-gold': '0 6px 20px -6px rgba(212, 168, 67, 0.45)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
