# @datacenter-tycoon/desktop

Electron desktop wrapper for Datacenter Tycoon.

## Architecture

- `packages/web` remains the only renderer codebase.
- `packages/desktop` owns the Electron main process, preload bridge, packaging, and desktop-only tooling.
- Development loads the Vite dev server at `http://127.0.0.1:5173`.
- Production copies `packages/web/dist` into `packages/desktop/dist/renderer` and loads `index.html` from there.

## Commands

- `npm run dev:desktop` — start the web renderer and Electron shell together from the repo root.
- `npm run build:desktop` — build the renderer, build Electron main/preload, and copy renderer assets into the desktop bundle.
- `npm run test:desktop` — run desktop unit tests.
- `npm run typecheck -w @datacenter-tycoon/desktop` — typecheck desktop sources.
- `npm run dist -w @datacenter-tycoon/desktop` — create distributable packages.

## Smoke checklist

1. Run `npm run dev:desktop`.
2. Confirm an Electron window opens and loads the existing game UI.
3. Confirm the app can be used normally without white-screen errors.
4. Confirm DevTools open in development only.
5. Run `npm run build:desktop`.
6. Launch the built app/package and confirm `dist/renderer/index.html` loads successfully.

## Release caveats

- Code signing and notarization are not configured yet.
- Auto-update is intentionally out of scope for this first wrapper.
- Native filesystem dialogs/save-load flows can be added later through new preload APIs.
- Platform-specific production icons (`.icns`, `.ico`) should replace the placeholder assets before public release.
