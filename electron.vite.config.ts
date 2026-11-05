import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const root = process.cwd();
const shared = resolve(root, "src/shared");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": shared,
      },
    },
    build: {
      rollupOptions: {
        external: ["better-sqlite3"],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": shared,
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@shared": shared,
        "@": resolve(root, "src/renderer"),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(root, "src/renderer/index.html"),
      },
    },
  },
});
