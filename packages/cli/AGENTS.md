# AGENTS.md — `@datacenter-tycoon/cli`

Guidance for contributors working in `packages/cli`.

## Scope

This package provides:
- one-shot CLI commands (`dct status`, `dct ls`, `dct add-rack`, ...)
- the local daemon transport/client bridge
- the interactive terminal UI

It must consume `@datacenter-tycoon/game-logic` rather than reimplementing rules.

## Architectural rules

- Keep daemon/game integration thin: `Action` values should flow directly into `reduce()`.
- Keep command handlers small and script-friendly.
- Prefer pure render helpers for TUI output so they are easy to snapshot test.
- Respect `--json` and machine-readable envelopes for all one-shot commands.

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
