import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptsDir, "..");
const rendererSource = path.resolve(desktopRoot, "../web/dist");
const rendererTarget = path.resolve(desktopRoot, "dist/renderer");

await access(path.join(rendererSource, "index.html"));
await rm(rendererTarget, { recursive: true, force: true });
await cp(rendererSource, rendererTarget, { recursive: true });

console.log(`Copied renderer assets from ${rendererSource} to ${rendererTarget}`);
