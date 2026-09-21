import sharedConfig from "@ordo/config-eslint/react";

export default [
  { ignores: ["dist", "node_modules"] },
  ...sharedConfig,
  {
    rules: {
      "react/jsx-no-target-blank": "off",
    },
  },
];
