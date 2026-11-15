import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const gameLogicPath = fileURLToPath(
  new URL("../game-logic/src/index.ts", import.meta.url),
);
const webIndexPath = fileURLToPath(
  new URL("../web/src/index.ts", import.meta.url),
);
const webSrcDir = fileURLToPath(
  new URL("../web/src", import.meta.url),
);
const assetsPath = fileURLToPath(
  new URL("../../assets", import.meta.url),
);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4174,
    allowedHosts: true,
  },
  resolve: {
    alias: [
      { find: "@datacenter-tycoon/game-logic", replacement: gameLogicPath },
      { find: /^@datacenter-tycoon\/web$/, replacement: webIndexPath },
      { find: /^@datacenter-tycoon\/web\/(.*)$/, replacement: `${webSrcDir}/$1` },
      { find: "@assets", replacement: assetsPath },
    ],
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
