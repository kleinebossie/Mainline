import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      maxWidth: {
        reading: "680px",
        wide: "1120px",
      },
      fontFamily: {
        sans: ["var(--font-public-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Raw palette: the analysis sheet
        paper: {
          DEFAULT: "hsl(var(--paper))",
          raised: "hsl(var(--paper-raised))",
        },
        ink: "hsl(var(--ink))",
        graphite: "hsl(var(--graphite))",
        line: "hsl(var(--line))",
        evergreen: {
          DEFAULT: "hsl(var(--evergreen))",
          bright: "hsl(var(--evergreen-bright))",
        },
        amber: "hsl(var(--amber))",
        clay: "hsl(var(--clay))",
        // Semantic aliases
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
        },
        correct: "hsl(var(--correct))",
        mistake: "hsl(var(--mistake))",
        text: {
          DEFAULT: "hsl(var(--text))",
          muted: "hsl(var(--text-muted))",
        },
        // Evidence grade ramp (chess annotation grammar)
        grade: {
          a: "hsl(var(--grade-a))",
          b: "hsl(var(--grade-b))",
          c: "hsl(var(--grade-c))",
          d: "hsl(var(--grade-d))",
        },
        // shadcn surface names (kept so existing utilities work)
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
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg, var(--radius))",
        md: "var(--radius-md, calc(var(--radius) - 2px))",
        sm: "var(--radius-sm, calc(var(--radius) - 4px))",
      },
      boxShadow: {
        sheet:
          "0 1px 2px hsl(var(--ink) / 0.04), 0 8px 24px -16px hsl(var(--ink) / 0.18)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
