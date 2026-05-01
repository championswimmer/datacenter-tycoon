# AGENTS.md — `@datacenter-tycoon/web`

## Framework Decision (ADR)

**Stack**: React 18 + Vite + TypeScript + Vanilla CSS + CSS Modules.

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React 18 + TypeScript** | `useSyncExternalStore` is a perfect fit for the game store pattern; largest ecosystem; no engine baggage. |
| Bundler / dev | **Vite** | Fast HMR, native ESM, minimal config, matches repo's ESM-first stance. |
| Styling | **Vanilla CSS + CSS variables + CSS Modules** | Zero runtime, intentional neon design, no Tailwind. |
| State | **Custom store** over `reduce()` from `game-logic` + `useSyncExternalStore` | Game state is already a pure reducer; no Redux/Zustand needed. |
| Routing | **Hash-based mini-router** | Single-screen app, no `react-router` dependency. |
| Tests | **Vitest** (components) + `node --test` for pure modules | De-facto Vite pairing. |

## Rules

- **No game rules here.** All simulation logic lives in `@datacenter-tycoon/game-logic`. This package is a view + input layer.
- Import game logic via the package name (`@datacenter-tycoon/game-logic`), never via relative paths across packages.
- Keep UI state separate from game state. Game state comes from `game-logic`; UI state (selected tab, modals open, etc.) lives in the frontend only.
- Prefer presentational components that take game state as props.
- All CSS goes through CSS Modules (`.module.css`) or the global theme files in `src/theme/`. No inline styles except dynamic values.
- The theme playground route `#/__theme` is dev-only — gate it with `import.meta.env.DEV`.

## Time and the tick→calendar mapping

- Internally, `state.tick` is the **number of elapsed months** since January 2025 (`EPOCH_YEAR`). Convention: **1 tick = 1 month**.
- **Never render `state.tick` directly** in any UI component. Always convert via helpers in `src/store/gameTime.ts`:
  - `tickToGameDate(tick, fraction?)` — integer tick + optional sub-tick fraction → `GameDate { year, month, day }`
  - `formatGameDate(d)` — `"15 Mar 2025"` (full date; use in HUD)
  - `formatGameDateShort(d)` — `"Mar 2025"` (month/year; use in log feed, sparkline)
  - `monthsAndDaysBetween(...)` / `formatRemaining(months, days)` — for contract expiry labels
- For **day-level precision** (advancing day display within a month), use `useTickFraction()` from `src/store/tickFractionStore.ts`. This hook subscribes to a per-frame external store updated by the tick driver — only components that call it re-render every animation frame.
- Code identifiers (`selectTick`, `expiresAtTick`, `startedAtTick`, `tickOpex`, `useTickDriver`, `setTickFraction`, etc.) intentionally retain the word "tick" — this is fine. Only **user-visible strings** must use calendar language.
