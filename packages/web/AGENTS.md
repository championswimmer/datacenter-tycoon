# AGENTS.md — `@datacenter-tycoon/web`

Web frontend. Framework choice (React/Vue/Svelte/etc.) is **not yet decided** — discuss before scaffolding.

## Rules

- **No game rules here.** All simulation logic lives in `@datacenter-tycoon/game-logic`. This package is a view + input layer.
- Import game logic via the package name, never via relative paths.
- Keep UI state separate from game state. Game state comes from `game-logic`; UI state (selected tab, modals) lives in the frontend.
- Prefer presentational components that take game state as props.
