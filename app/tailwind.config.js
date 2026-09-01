/** @type {import('tailwindcss').Config} */
// Palette and motion values trace to design-system/02-design-tokens.md (Auctum Ledger / Greensheet system).
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Archivo', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Brand scales (design-token hexes) ──────────────────────────
        navy: { DEFAULT: "#16323E", 700: "#16323E", 800: "#12252F", 900: "#0E1A22" },
        teal: {
          DEFAULT: "#2A6E73",
          100: "#DCEAEA",
          300: "#7FB6BA",
          500: "#3D8A90",
          600: "#2A6E73",
          700: "#1F4F54",
          800: "#1F4F54",
        },
        gold: {
          DEFAULT: "#C9A34A",
          100: "#F0E6CC",
          300: "#D4B96A",
          500: "#C9A34A",
          600: "#7A5F22",
          deep: "#B8923F",   // hover on gold fills
          brass: "#A8842E",  // chart fills that must clear 3:1 on parchment
        },
        cherry: { DEFAULT: "#8C3B34", 100: "#F9E6E2", 600: "#8C3B34" },
        green: { DEFAULT: "#3E6B50", 100: "#E5EFE7", 300: "#9FD3B4", 600: "#3E6B50" },
        roast: { DEFAULT: "#4A3527", 100: "#E9DFD2", 700: "#4A3527" },
        parchment: {
          DEFAULT: "#F6F1E7",
          50: "#FDFBF5",
          100: "#F6F1E7",
          200: "#EFE8DA",
          300: "#E4DCC9",
        },
        ink: "#221D16",

        // ── Semantic status (tokens §status) ───────────────────────────
        success: { DEFAULT: "#33684A", soft: "#E5EFE7" },
        warning: { DEFAULT: "#8A5F14", soft: "#FBF0DA" },
        danger: { DEFAULT: "#9E3D31", soft: "#F9E6E2" },
        info: { DEFAULT: "#2C6E8C", soft: "#E4EEF3" },
        clay: { DEFAULT: "#8C4A22", soft: "#F5E3D3" },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "0 1px 2px rgba(34, 29, 22, 0.05)",
        "card-hover": "0 10px 30px -12px rgba(14, 26, 34, 0.18)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        entrance: "cubic-bezier(0, 0, 0.2, 1)",
        compass: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "page-enter": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "page-enter": "page-enter 0.5s cubic-bezier(0, 0, 0.2, 1) both",
        "fade-in": "fade-in 0.35s cubic-bezier(0, 0, 0.2, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
