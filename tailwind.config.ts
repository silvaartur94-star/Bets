import type { Config } from "tailwindcss";

const v = (name: string) => `var(--${name})`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        line: v("border"),
        ink: v("text"),
        muted: v("muted"),
        faint: v("faint"),
        accent: v("accent"),
        "accent-soft": v("accent-soft"),
        good: v("good"),
        "good-soft": v("good-soft"),
        bad: v("bad"),
        "bad-soft": v("bad-soft"),
        warn: v("warn"),
        "warn-soft": v("warn-soft"),
      },
    },
  },
  plugins: [],
} satisfies Config;
