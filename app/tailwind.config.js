/** @type {import('tailwindcss').Config} */
// Auctum Ledger — Museum Folio. All semantic colors are CSS-var backed (see
// src/styles/tokens.css + src/index.css); dark mode is a single attribute flip.
// Brand scales and motion trace to design-system/02-design-tokens.md §10.
module.exports = {
  darkMode: ["class"],
<<<<<<< HEAD
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
=======
  // contracts/ is scanned too: the Trust band classes live in
  // contracts/trust.ts so the model and its colours cannot drift apart, and
  // Tailwind would purge them if it never saw that file.
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './contracts/**/*.{ts,tsx}',
  ],
>>>>>>> 527c1b18d311003ed07956b97c9b37ef58a1c88c
  theme: {
    extend: {
      fontFamily: {
        display: [
          "Playfair Display",
          "Georgia",
          "serif",
        ],
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        // ── Museum Folio ──────────────────────────────────────────────────
        // Registered so Trust and Scanner components consume tokens by name.
        // The token test fails the build if one of them reaches for a hex.
        ink: { 900: "hsl(var(--ink-900))", 700: "hsl(var(--ink-700))" },
        paper: { 50: "hsl(var(--paper-50))", 100: "hsl(var(--paper-100))" },
        brass: {
          300: "hsl(var(--brass-300))",
          500: "hsl(var(--brass-500))",
          700: "hsl(var(--brass-700))",
        },
        sage: {
          100: "hsl(var(--sage-100))",
          600: "hsl(var(--sage-600))",
          800: "hsl(var(--sage-800))",
        },
        oxblood: {
          100: "hsl(var(--oxblood-100))",
          500: "hsl(var(--oxblood-500))",
          700: "hsl(var(--oxblood-700))",
        },
        neutral: {
          200: "hsl(var(--neutral-200))",
          500: "hsl(var(--neutral-500))",
          700: "hsl(var(--neutral-700))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          tint: "hsl(var(--danger-tint))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        sidebar: {
          DEFAULT: "rgb(var(--sidebar-background) / <alpha-value>)",
          foreground: "rgb(var(--sidebar-foreground) / <alpha-value>)",
          primary: "rgb(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground":
            "rgb(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "rgb(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground":
            "rgb(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "rgb(var(--sidebar-border) / <alpha-value>)",
          ring: "rgb(var(--sidebar-ring) / <alpha-value>)",
        },

        // ── Museum Folio semantic (CSS-var backed) ──────────────────────────
        canvas: "rgb(var(--auctum-bg-canvas) / <alpha-value>)",
        surface: "rgb(var(--auctum-bg-surface) / <alpha-value>)",
        recessed: "rgb(var(--auctum-bg-recessed) / <alpha-value>)",
        subtle: "rgb(var(--auctum-text-subtle) / <alpha-value>)",
        borderStrong: "rgb(var(--auctum-border-strong) / <alpha-value>)",
        borderInteractive: "rgb(var(--auctum-border-interactive) / <alpha-value>)",

        // ── Brand primitives (static) — Museum Folio ────────────────────────
        oxblood: { DEFAULT: "#74362F", 800: "#5E2B25", 700: "#74362F", 300: "#C9978F", 100: "#F2E3E0" },
        brass: { DEFAULT: "#947642", 600: "#6E572C", 500: "#947642", 300: "#C9A86A", 100: "#F0E6CC" },
        sage: { DEFAULT: "#4F6958", 700: "#3E5546", 600: "#4F6958", 300: "#8FAF9B", 100: "#E4EBE4" },
        ink: { DEFAULT: "#221E1B", 900: "#221E1B", 700: "#58514B" },
        paper: { DEFAULT: "#F5F2EB", 50: "#FAF9F4", 100: "#F5F2EB", 200: "#EDE7DA", 300: "#E4DECE" },
        neutral: { DEFAULT: "#8A8272", 400: "#D9D3C9", 500: "#B9AE97", 600: "#8A8272", 700: "#5C5546" },

        // ── Status (tokens §2.2) ────────────────────────────────────────────
        success: { DEFAULT: "#4F6958", bg: "#E4EBE4", soft: "#E5EFE7" },
        warning: { DEFAULT: "#A36A29", bg: "#F6EBD8", soft: "#FBF0DA" },
        danger: { DEFAULT: "#962C2C", bg: "#F5E0DE", soft: "#F9E6E2" },
        info: { DEFAULT: "#6E572C", bg: "#F0E6CC", soft: "#E4EEF3" },
        clay: { DEFAULT: "#8C4A22", soft: "#F5E3D3" },

        // ── Legacy Greensheet heritage palette (retained for pre-Folio pages) ──
        navy: { DEFAULT: "#16323E", 700: "#16323E", 800: "#12252F", 900: "#0E1A22" },
        teal: {
          DEFAULT: "#2A6E73", 100: "#DCEAEA", 300: "#7FB6BA", 500: "#3D8A90",
          600: "#2A6E73", 700: "#1F4F54", 800: "#1F4F54",
        },
        gold: {
          DEFAULT: "#C9A34A", 100: "#F0E6CC", 300: "#D4B96A", 500: "#C9A34A",
          600: "#7A5F22", deep: "#B8923F", brass: "#A8842E",
        },
        cherry: { DEFAULT: "#8C3B34", 100: "#F9E6E2", 600: "#8C3B34" },
        green: { DEFAULT: "#3E6B50", 100: "#E5EFE7", 300: "#9FD3B4", 600: "#3E6B50" },
        roast: { DEFAULT: "#4A3527", 100: "#E9DFD2", 700: "#4A3527" },
        parchment: { DEFAULT: "#F6F1E7", 50: "#FDFBF5", 100: "#F6F1E7", 200: "#EFE8DA", 300: "#E4DCC9" },
      },
      fontSize: {
        caption: ["0.8125rem", { lineHeight: "1.3", letterSpacing: "0.02em" }],
        sm: ["0.875rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.5" }],
        lg: ["1.25rem", { lineHeight: "1.4", letterSpacing: "-0.005em" }],
        xl: ["1.5625rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "2xl": ["1.9531rem", { lineHeight: "1.25", letterSpacing: "-0.012em" }],
        "3xl": ["2.4414rem", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "4xl": ["3.0518rem", { lineHeight: "1.15", letterSpacing: "-0.018em" }],
        "5xl": ["3.8147rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        e1: "0 1px 2px 0 rgb(34 30 27 / 0.07)",
        e2: "0 2px 4px -1px rgb(34 30 27 / 0.08), 0 4px 8px -2px rgb(34 30 27 / 0.06)",
        e3: "0 4px 8px -2px rgb(34 30 27 / 0.09), 0 10px 20px -4px rgb(34 30 27 / 0.08)",
        e4: "0 8px 16px -4px rgb(34 30 27 / 0.10), 0 20px 32px -8px rgb(34 30 27 / 0.10)",
        e5: "0 16px 48px -8px rgb(34 30 27 / 0.18)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "0 1px 2px rgba(34, 30, 27, 0.05)",
        "card-hover": "0 10px 30px -12px rgba(34, 30, 27, 0.18)",
      },
      transitionDuration: {
        instant: "100ms",
        fast: "150ms",
        base: "250ms",
        slow: "350ms",
        slower: "500ms",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        entrance: "cubic-bezier(0, 0, 0.2, 1)",
        compass: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        seal: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      screens: {
        xs: "480px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      zIndex: {
        sticky: 100,
        dropdown: 200,
        overlay: 300,
        modal: 400,
        max: 999,
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