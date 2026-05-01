// Electron toolchain note:
//
// This package now builds with the TypeScript compiler and runs Electron
// directly from the emitted `dist/` output so that it can consume the
// separately built `packages/web` renderer without introducing a second
// Vite renderer pipeline under `packages/desktop`.
//
// The file is intentionally kept as documentation for the earlier
// electron-vite research path, but it is not used by the current scripts.
export {};
