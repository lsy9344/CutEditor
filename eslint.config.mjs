import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Ignore generated and non-source folders (flat config ignores replace .eslintignore)
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.venv/**",
      "**/venv/**",
      "public/**",
      "original_source/**",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript support (provides parser + TS-aware rules)
  ...tseslint.configs.recommended,

  // React recommended rules (flat config)
  reactPlugin.configs.flat.recommended,

  // Project-wide options and small tweaks (browser code)
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Using the new JSX transform (no need to import React in scope)
      "react/react-in-jsx-scope": "off",
    },
  },

  // Node environment for config and script files
  {
    files: [
      "*.{js,cjs,mjs,ts}",
      ".*.{js,cjs,mjs,ts}",
      "**/{scripts,config}/**/*.{js,ts}",
      "**/*.{config,conf,rc}.{js,cjs,mjs,ts}",
      "**/{vite,eslint,tailwind,postcss,rollup,webpack,tsup,babel}.config.{js,cjs,mjs,ts}",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Global settings
  {
    settings: {
      react: { version: "detect" },
    },
  },
]);
