# AGENTS.md — `@datacenter-tycoon/server`

Backend services: score submission, leaderboards, and (later) multiplayer session hosting.

## Rules

- Reuse `@datacenter-tycoon/game-logic` to validate submitted runs / replay seeds — never re-implement scoring rules.
- Keep transport (HTTP/WebSocket) thin; delegate logic to `game-logic` where possible.
- Treat all client input as untrusted — verify replays by re-running the deterministic simulation server-side.
