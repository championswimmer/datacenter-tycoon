# AGENTS.md — `@datacenter-tycoon/cli`

Guidance for contributors working in `packages/cli`.

## Scope

This package provides:
- one-shot CLI commands (`dct status`, `dct ls`, `dct dc ...`, `dct racks ...`, `dct contract ...`, ...)
- the local daemon transport/client bridge
- the interactive terminal UI

It must consume `@datacenter-tycoon/game-logic` rather than reimplementing rules.

## Architectural rules

- Keep daemon/game integration thin: `Action` values should flow directly into `reduce()`.
- Keep command handlers small and script-friendly.
- Prefer grouped noun-first command routers (`dc`, `racks`, `contract`) over adding new flat verb commands.
- Prefer pure render helpers for TUI output so they are easy to snapshot test.
- Respect `--json` and machine-readable envelopes for all one-shot commands.
- TUI state should be derived from daemon snapshots and events, not from duplicate game rules.

## TUI ADR

### Decision
Use a **tiny custom ANSI / readline-based TUI helper** instead of adding `ink`.

### Why
- keeps hard runtime dependencies minimal
- keeps one-shot CLI startup fast
- enough for the current tabbed dashboard + command palette + live-update needs
- easier to test with plain string renderers and captured terminal output

### Consequences
- we own input handling and screen rendering
- keep renderer modular under `src/tui/`
- if the TUI grows substantially, reevaluate `ink` or another renderer later

## File map

- `src/cli.ts` — CLI entry and dispatch
- `src/client/` — RPC client and daemon auto-spawn
- `src/daemon/` — runtime, persistence, socket transport, lifecycle
- `src/commands/` — one-shot command handlers
- `src/tui/` — render helpers, tab content, command palette helpers

## Testing guidance

When changing the CLI:
- add or update command unit tests under `src/commands/*.test.ts`
- add renderer tests for new TUI views
- run `npm run test -w @datacenter-tycoon/cli`
- run `npm run typecheck -w @datacenter-tycoon/cli`

For multi-step work, update `.agents/plans/009-cli-client.md` as progress changes.
