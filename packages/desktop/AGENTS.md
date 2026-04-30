# AGENTS.md — `@datacenter-tycoon/desktop`

Planned Electron wrapper around the web frontend. **Not yet implemented** — do not scaffold unless asked.

## Rules

- The desktop app should reuse `@datacenter-tycoon/web` as its renderer rather than duplicating UI.
- Main-process code (Node-only) goes here; never import Node APIs from `web` or `game-logic`.
