import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["out", "dist", "node_modules", "demo"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "electron",
                "better-sqlite3",
                "bcryptjs",
                "fs",
                "fs/*",
                "path",
                "path/*",
                "os",
                "crypto",
                "child_process",
                "net",
                "http",
                "https",
                "node:*",
              ],
              message:
                "The renderer must not import Node or Electron modules. Call window.api instead.",
            },
          ],
        },
      ],
    },
  },
);
