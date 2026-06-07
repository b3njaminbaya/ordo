/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        // Semantic surface / text / border tokens — resolved at runtime via CSS variables
        // so dark mode works by swapping the variables in .dark { ... }
        page:    "var(--color-page)",
        surface: {
          DEFAULT: "var(--color-surface)",
          muted:   "var(--color-surface-muted)",
        },
        border:  "var(--color-border)",
        text: {
          DEFAULT: "var(--color-text)",
          muted:   "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        sidebar: "var(--color-sidebar)",

        // Brand / semantic colors — constant across themes
        primary: {
          DEFAULT: "#6366F1",
          hover:   "#4F46E5",
          dark:    "#3730A3",
          light:   "#EEF2FF",
        },
        success: {
          DEFAULT: "#10B981",
          dark:    "#065F46",
          light:   "#ECFDF5",
        },
        warning: {
          DEFAULT: "#F59E0B",
          dark:    "#78350F",
          light:   "#FFFBEB",
        },
        danger: {
          DEFAULT: "#EF4444",
          dark:    "#991B1B",
          light:   "#FEF2F2",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card:   "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        modal:  "0 20px 60px -12px rgb(0 0 0 / 0.25), 0 8px 20px -8px rgb(0 0 0 / 0.1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in":  "fade-in 0.15s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [],
};
