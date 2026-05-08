import js from "@eslint/js";
import globals from "globals";

/** Base ESLint config for all Taskly JS/TS packages */
export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console":     "off",
    },
  },
];
