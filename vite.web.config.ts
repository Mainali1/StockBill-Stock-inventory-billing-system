import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = process.cwd();

export default defineConfig({
  root: "src/renderer",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(root, "src/shared"),
      "@": resolve(root, "src/renderer"),
    },
  },
  server: {
    port: 5173,
  },
});
