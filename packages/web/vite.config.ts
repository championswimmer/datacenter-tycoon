import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const gameLogicPath = fileURLToPath(
  new URL("../game-logic/src/index.ts", import.meta.url),
);
const assetsPath = fileURLToPath(
  new URL("../../assets", import.meta.url),
);

function githubPagesSpaRoutes(): Plugin {
  return {
    name: "github-pages-spa-routes",
    async closeBundle() {
      const distDir = fileURLToPath(new URL("./dist", import.meta.url));
      const indexHtml = path.join(distDir, "index.html");
      if (!existsSync(indexHtml)) {
        return;
      }
      await Promise.all([
        mkdir(path.join(distDir, "2d"), { recursive: true }),
        mkdir(path.join(distDir, "3d"), { recursive: true }),
      ]);
      await Promise.all([
        copyFile(indexHtml, path.join(distDir, "2d", "index.html")),
        copyFile(indexHtml, path.join(distDir, "3d", "index.html")),
        copyFile(indexHtml, path.join(distDir, "404.html")),
      ]);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), githubPagesSpaRoutes()],
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
