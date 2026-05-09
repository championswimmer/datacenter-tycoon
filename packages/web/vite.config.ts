import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const gameLogicPath = fileURLToPath(
  new URL("../game-logic/src/index.ts", import.meta.url),
);
const assetsPath = fileURLToPath(
  new URL("../../assets", import.meta.url),
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@datacenter-tycoon/game-logic": gameLogicPath,
      "@assets": assetsPath,
    },
    // Align with TypeScript's bundler module resolution
    conditions: ["import", "module", "browser", "default"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      reportsDirectory: "./coverage",
    },
  },
});
