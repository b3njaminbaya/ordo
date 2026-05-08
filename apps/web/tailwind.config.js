import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Load the shared design-token preset from @taskly/ui (CJS module).
const tasklyPreset = require("@taskly/ui/tailwind");

/** @type {import('tailwindcss').Config} */
export default {
  presets: [tasklyPreset],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Web-specific additions on top of the @taskly/ui preset.
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
