# packages/web-3d — AGENTS.md

Package-specific guidelines for the isometric 3D web client (`@datacenter-tycoon/web-3d`).

## Architecture & Purity Rules

- **React 18 + Vite + TypeScript (strict) + CSS Modules**, matching `@datacenter-tycoon/web`.
- **No game rules here**: Never reimplement contract eligibility, fit checks, effective capacity, cooling/power/network limits, maintenance health rules, or move targets in `packages/web-3d`. Always read via `@datacenter-tycoon/web` selectors or `@datacenter-tycoon/game-logic` helpers.
- **Query-boundary compliance**: Do not reference `state.activeContracts`, `state.contractMarket`, raw contract status strings (`"active"`, `"breached"`, `"expired"`, `"cancelled"`), or raw `datacenter.spec.{powerCapacityKw,coolingCapacityBtuPerHr,bandwidthGbps,networkType,coolingType}` outside tests.
- **Time formatting**: Never display raw `state.tick` to players; format via `tickToGameDate`, `formatGameDate`, `formatGameDateShort`, `formatRemaining`, and `useTickFraction` from `@datacenter-tycoon/web`.
- **Rendering engine separation**: Pure Canvas 2D isometric math, camera transforms, procedural 3D meshes, and scenes live under `src/engine/` and must stay decoupled from React hooks so they can be unit-tested deterministically.
