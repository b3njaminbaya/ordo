import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load the shared design-token preset from @teevexa-ordo/ui (CJS module).
const teevexaOrdoPreset = require("@teevexa-ordo/ui/tailwind");

/** @type {import('tailwindcss').Config} */
export default {
  presets: [teevexaOrdoPreset],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Web-specific additions on top of the @teevexa-ordo/ui preset.
      borderRadius: {
        sm: "0.375rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      animation: {
        "spin-slow": "spin 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};
