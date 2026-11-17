# AGENTS.md — `@datacenter-tycoon/web`

## Framework Decision (ADR)

**Stack**: React 18 + Vite + TypeScript + Vanilla CSS + CSS Modules.

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React 18 + TypeScript** | `useSyncExternalStore` is a perfect fit for the game store pattern; largest ecosystem; no engine baggage. |
| Bundler / dev | **Vite** | Fast HMR, native ESM, minimal config, matches repo's ESM-first stance. |
| Styling | **Vanilla CSS + CSS variables + CSS Modules** | Zero runtime, intentional neon design, no Tailwind. |
| State | **Custom store** over `reduce()` from `game-logic` + `useSyncExternalStore` | Game state is already a pure reducer; no Redux/Zustand needed. |
| Routing | **Pathname view mode + hash-based mini-router** | `/2d` and `/3d` pathnames select the shell (`Shell` vs lazy `IsoShell`), while `#/...` routes views inside the active shell with no `react-router` dependency. |
| Tests | **Vitest** (components) + `node --test` for pure modules | De-facto Vite pairing. |

## Unified 2D / Isometric 3D Shell & Modules

- **View mode routing & persistence (`src/store/viewModePreference.ts`)**: `/2d` and `/3d` pathnames select between the classic 2D `Shell` and the isometric 3D `IsoShell`, persisted in `localStorage` under `datacenter-tycoon:view-mode-v1` (defaulting to `"2d"` when neither URL nor stored preference is set).
- **Isometric 3D modules**:
  - `src/engine/` — isometric projection math (`isoMath.ts`), camera controller (`camera.ts`), 3D canvas primitives/rack models (`primitives3d.ts`, `rackModels3d.ts`), and city/floor renderers (`cityScene.ts`, `floorScene.ts`).
  - `src/state/viewportState.ts` — UI-only camera, hover, selection, and build-tool state for the isometric canvas.
  - `src/ui/viewport/` — interactive `IsoViewportCanvas` canvas host.
  - `src/ui/hud/` — isometric HUD overlays (`TopHudBar`, `BuildDock`, `InspectorPanel`, `InfoOverlayDock`).
  - `src/ui/shell/IsoShell.tsx` — lazy-loaded isometric shell wiring the viewport, HUD, and shared modals/drawers to the store.
- Keep `src/engine/`, `src/state/viewportState.ts`, `src/ui/hud/`, `src/ui/viewport/`, and `IsoShell.tsx` free of game rules; consume `@datacenter-tycoon/game-logic` through `src/store/selectors.ts` and store actions.

## Rules

- **No game rules here.** All simulation logic lives in `@datacenter-tycoon/game-logic`. This package is a view + input layer.
- Shared gameplay queries (contract buckets, contract fit, datacenter available capacity, maintenance staffing affordances, move-target discovery, effective datacenter infrastructure, upgrade affordances) must come from exported `@datacenter-tycoon/game-logic` helpers or thin web selectors over those helpers — never from UI-local reducers or helper files.
- Contract-market and assignment UI must keep region-affinity badges, allowed-region copy, and eligible-datacenter filtering sourced from canonical selectors / game-logic summaries. Do not rebuild whitelist logic locally or re-enable blocked wrong-region datacenters in component code.
- Treat `datacenter.spec.powerCapacityKw`, `coolingCapacityBtuPerHr`, `bandwidthGbps`, `networkType`, and `coolingType` as blueprint-display fields only. Upgrade-aware UI must render canonical infrastructure/upgrade selectors instead of raw spec capacities.
- Import game logic via the package name (`@datacenter-tycoon/game-logic`), never via relative paths across packages.
- Keep UI state separate from game state. Game state comes from `game-logic`; UI state (selected tab, modals open, etc.) lives in the frontend only.
- Online leaderboard identity is browser-local: when no stored identity exists, the start flow may register the chosen unique username with the backend, persist the returned `playerId`, and reuse that same identity for future submissions. Do not force re-registration for every run.
- Prefer presentational components that take game state as props.
- All CSS goes through CSS Modules (`.module.css`) or the global theme files in `src/theme/`. No inline styles except dynamic values.
- The theme playground route `#/__theme` is dev-only — gate it with `import.meta.env.DEV`.
- Mobile-first responsive rules live in `src/theme/tokens.css`, `src/theme/global.css`, and `src/ui/responsive.ts`. Keep phone layout changes at `max-width: 767px`, tablet adjustments at `max-width: 1023px`, and preserve desktop behavior above those breakpoints unless a bug is being fixed.
- Use a minimum 44px touch target for interactive controls on phone/coarse-pointer layouts, with 48px preferred for floating edge tabs, icon-only buttons, and dismiss controls.
- Phone navigation panels should become overlay drawers or bottom sheets that use `var(--safe-area-*)` padding and `var(--mobile-bottom-sheet-max-height)` / `var(--mobile-drawer-max-width)` instead of fixed desktop widths.
- Scroll-heavy drawers and modal bodies should own their own scrolling and include visible affordances such as inset shadows or grab handles so phone users can tell when content continues offscreen.

## Time and the tick→calendar mapping

- Internally, `state.tick` is the **number of elapsed months** since January 2025 (`EPOCH_YEAR`). Convention: **1 tick = 1 month**.
- **Never render `state.tick` directly** in any UI component. Always convert via helpers in `src/store/gameTime.ts`:
  - `tickToGameDate(tick, fraction?)` — integer tick + optional sub-tick fraction → `GameDate { year, month, day }`
  - `formatGameDate(d)` — `"15 Mar 2025"` (full date; use in HUD)
  - `formatGameDateShort(d)` — `"Mar 2025"` (month/year; use in log feed, sparkline)
  - `monthsAndDaysBetween(...)` / `formatRemaining(months, days)` — for contract expiry labels
- For **day-level precision** (advancing day display within a month), use `useTickFraction()` from `src/store/tickFractionStore.ts`. This hook subscribes to a per-frame external store updated by the tick driver — only components that call it re-render every animation frame.
- Code identifiers (`selectTick`, `expiresAtTick`, `startedAtTick`, `tickOpex`, `useTickDriver`, `setTickFraction`, etc.) intentionally retain the word "tick" — this is fine. Only **user-visible strings** must use calendar language.
