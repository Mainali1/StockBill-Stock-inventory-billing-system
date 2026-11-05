import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = process.cwd();
const shared = resolve(root, "src/shared");
const renderer = resolve(root, "src/renderer");

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@shared": shared,
          },
        },
        test: {
          name: "main",
          environment: "node",
          include: [
            "src/main/**/*.test.ts",
            "src/shared/**/*.test.ts",
            "scripts/**/*.test.ts",
            "tests/**/*.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@shared": shared,
            "@": renderer,
          },
        },
        test: {
          name: "renderer",
          environment: "jsdom",
          include: ["src/renderer/**/*.test.{ts,tsx}"],
          setupFiles: ["src/renderer/test/setup.ts"],
        },
      },
    ],
  },
});
