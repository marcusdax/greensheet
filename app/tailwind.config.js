/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  // contracts/ is scanned too: the Trust band classes live in
  // contracts/trust.ts so the model and its colours cannot drift apart, and
  // Tailwind would purge them if it never saw that file.
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './contracts/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
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
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}