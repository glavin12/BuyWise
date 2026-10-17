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
      // The package index puts all ~1,850 lucide icons in the bundle; src/ui/icons.ts imports each one from its own file.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { paths: [{ name: "lucide-react-native", message: "Import icons from @/ui/icons (src/ui/icons.ts).", allowTypeImports: true }] },
      ],
    },
  },
]);
