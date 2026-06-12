import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  publicDir: "public",
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, "devtools.html"),
        panel: resolve(__dirname, "panel.html")
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js"
      }
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
