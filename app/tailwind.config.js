/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // semantic (CSS-var backed; vars emitted from tokens.json)
        canvas:    'rgb(var(--gs-bg-canvas) / <alpha-value>)',
        surface:   'rgb(var(--gs-bg-surface) / <alpha-value>)',
        recessed:  'rgb(var(--gs-bg-recessed) / <alpha-value>)',
        ink:       'rgb(var(--gs-text-primary) / <alpha-value>)',
        muted:     'rgb(var(--gs-text-muted) / <alpha-value>)',
        subtle:    'rgb(var(--gs-text-subtle) / <alpha-value>)',
        // brand primitives (static)
        navy:   { DEFAULT: '#16323E', 800: '#12252F', 900: '#0E1A22', 600: '#1F4F54' },
        teal:   { DEFAULT: '#2A6E73', 700: '#1F4F54', 500: '#3D8A90', 300: '#7FB6BA', 100: '#DCEAEA' },
        gold:   { DEFAULT: '#C9A34A', 600: '#7A5F22', 300: '#D4B96A', 100: '#F0E6CC' },
        cherry: { DEFAULT: '#8C3B34', 300: '#E8B4A6', 100: '#F9E6E2' },
        roast:  { DEFAULT: '#4A3527', 800: '#3A2A1E', 100: '#E9DFD2' },
        leaf:   { DEFAULT: '#3E6B50', 300: '#9FD3B4', 100: '#E5EFE7' },  // greensheet green
        parchment: { DEFAULT: '#F6F1E7', 50: '#FDFBF5', 200: '#EFE8DA', 300: '#E4DCC9' },
        success: { DEFAULT: '#33684A', bg: '#E5EFE7' },
        warning: { DEFAULT: '#8A5F14', bg: '#FBF0DA' },
        danger:  { DEFAULT: '#9E3D31', bg: '#F9E6E2' },
        info:    { DEFAULT: '#2C6E8C', bg: '#E4EEF3' },
      },
      fontFamily: {
        display: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans:    ['Archivo', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        caption: ['0.8125rem', { lineHeight: '1.3',  letterSpacing: '0.02em' }],
        sm:      ['0.875rem',  { lineHeight: '1.5' }],
        base:    ['1rem',      { lineHeight: '1.5' }],
        lg:      ['1.25rem',   { lineHeight: '1.4',  letterSpacing: '-0.005em' }],
        xl:      ['1.5625rem', { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
        '2xl':   ['1.9531rem', { lineHeight: '1.25', letterSpacing: '-0.012em' }],
        '3xl':   ['2.4414rem', { lineHeight: '1.2',  letterSpacing: '-0.015em' }],
        '4xl':   ['3.0518rem', { lineHeight: '1.15', letterSpacing: '-0.018em' }],
        '5xl':   ['3.8147rem', { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
      },
      spacing: {
        18: '4.5rem', 22: '5.5rem',
      },
      borderRadius: {
        xs: '2px', sm: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px',
      },
      boxShadow: {
        'e1': '0 1px 2px 0 rgb(22 50 62 / 0.07)',
        'e2': '0 2px 4px -1px rgb(22 50 62 / 0.08), 0 4px 8px -2px rgb(22 50 62 / 0.06)',
        'e3': '0 4px 8px -2px rgb(22 50 62 / 0.09), 0 10px 20px -4px rgb(22 50 62 / 0.08)',
        'e4': '0 8px 16px -4px rgb(22 50 62 / 0.10), 0 20px 32px -8px rgb(22 50 62 / 0.10)',
        'e5': '0 16px 48px -8px rgb(22 50 62 / 0.18)',
      },
      transitionDuration: {
        instant: '100ms', fast: '150ms', base: '250ms', slow: '350ms', slower: '500ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        compass:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      screens: { xs: '480px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
      zIndex: { dropdown: '10', sticky: '20', modal: '50', overlay: '100', max: '999' },
    },
  },
  plugins: [],
}
