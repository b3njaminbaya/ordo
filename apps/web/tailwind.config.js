import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load the shared design-token preset from @ordo/ui (CJS module).
const ordoPreset = require("@ordo/ui/tailwind");

/** @type {import('tailwindcss').Config} */
export default {
  presets: [ordoPreset],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Web-specific additions on top of the @ordo/ui preset.
      borderRadius: {
        sm: "0.375rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      keyframes: {
        "slide-in-left": {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "spin-slow": "spin 1.5s linear infinite",
        "slide-in-left": "slide-in-left 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
