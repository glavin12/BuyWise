// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Mobile guide: type everything, `any` needs a documented reason (disable per line).
      "@typescript-eslint/no-explicit-any": "error",
      // No sensitive data in logs: only warn/error survive, and only for real problems.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
]);
