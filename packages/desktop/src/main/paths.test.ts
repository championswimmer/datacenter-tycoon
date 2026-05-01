import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolvePreloadPath, resolveRendererEntry } from "./paths.js";

test("resolvePreloadPath points to the built preload bundle", () => {
  const currentDir = path.join("/tmp", "desktop", "dist", "main");

  assert.equal(
    resolvePreloadPath(currentDir),
    path.join("/tmp", "desktop", "dist", "preload", "index.js"),
  );
});

test("resolveRendererEntry prefers dev server URL when present", () => {
  const entry = resolveRendererEntry("/unused", "http://127.0.0.1:5173");

  assert.deepEqual(entry, {
    kind: "url",
    value: "http://127.0.0.1:5173",
  });
});

test("resolveRendererEntry falls back to the copied renderer index.html", () => {
  const currentDir = path.join("/tmp", "desktop", "dist", "main");

  assert.deepEqual(resolveRendererEntry(currentDir, undefined), {
    kind: "file",
    value: path.join("/tmp", "desktop", "dist", "renderer", "index.html"),
  });
});
