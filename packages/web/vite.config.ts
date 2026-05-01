import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@datacenter-tycoon/game-logic": fileURLToPath(
        new URL("../game-logic/src/index.ts", import.meta.url),
      ),
    },
    // Align with TypeScript's bundler module resolution
    conditions: ["import", "module", "browser", "default"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
