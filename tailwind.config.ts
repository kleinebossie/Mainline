import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Tokens come from planning/DESIGN.md. Colour names are the palette's own words: `sheet`
// and `rule` are surfaces, `tile`/`sage`/`ochre`/`brick` are the evidence ramp, `biro` is
// interaction only. Nothing is a compatibility alias of anything.
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: { "2xl": "1120px" },
    },
    extend: {
      fontFamily: {
        // UI + display lettering (variable: weight 100-900, width 62-125)
        sans: ['var(--font-archivo)', "system-ui", "sans-serif"],
        heading: ['var(--font-archivo)', "system-ui", "sans-serif"],
        // prose only: rationale, caveats, landing copy
        serif: ['var(--font-newsreader)', "Georgia", "serif"],
        // data only: move numbers, minutes, ratings, grade glyphs
        mono: ['var(--font-plex-mono)', "ui-monospace", "monospace"],
      },
      colors: {
        // raw palette — the annotated scoresheet
        paper: "hsl(var(--paper))",
        sheet: "hsl(var(--sheet))",
        ink: "hsl(var(--ink))",
        graphite: "hsl(var(--graphite))",
        rule: "hsl(var(--rule))",
        biro: "hsl(var(--biro))",
        tile: "hsl(var(--tile))",
        sage: "hsl(var(--sage))",
        ochre: "hsl(var(--ochre))",
        brick: "hsl(var(--brick))",
        // evidence grade ramp (chess annotation grammar)
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
        DEFAULT: "3px",
        xs: "1px",
        sm: "2px",
        md: "3px",
        lg: "6px",
        xl: "8px",
      },
      boxShadow: {
        // one elevation step in the whole product: a sheet lifted 1px off the page
        sheet: "0 1px 0 hsl(var(--ink) / 0.05)",
        // floating layers only (menus, popovers)
        float: "0 0 0 1px hsl(var(--ink) / 0.06), 0 12px 32px -20px hsl(var(--ink) / 0.5)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
