// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      "dist/**",
      "static-build/**",
      "server_dist/**",
      "playwright-report/**",
      "test-results/**",
      "attached_assets/**",
      ".local/**",
      ".claude/**",
    ],
    // Formatting is checked separately; lint should report code-quality issues.
    rules: {
      "prettier/prettier": "off",
    },
  },
]);
