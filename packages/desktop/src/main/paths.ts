import path from "node:path";

export interface RendererEntry {
  kind: "url" | "file";
  value: string;
}

export function resolvePreloadPath(currentDir: string): string {
  return path.join(currentDir, "../preload/index.js");
}

export function resolveRendererEntry(
  currentDir: string,
  rendererUrl = process.env.ELECTRON_RENDERER_URL,
): RendererEntry {
  if (rendererUrl) {
    return {
      kind: "url",
      value: rendererUrl,
    };
  }

  return {
    kind: "file",
    value: path.join(currentDir, "../renderer/index.html"),
  };
}
