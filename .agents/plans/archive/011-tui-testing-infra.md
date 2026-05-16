---
name: TUI Testing Infrastructure
description: Implement robust TUI testing with virtual terminals, automated interactions, and snapshot testing.
status: completed
created: 2026-05-02
updated: 2026-05-02
owner: cli
---

## Progress

- [x] **Phase 1 — Research & Prototyping**
  - [x] 1.1 Prototype `@microsoft/tui-test` integration for E2E
  - [x] 1.2 Evaluate `ink-testing-library` style pure-render tests for layout units
- [x] **Phase 2 — Infrastructure Setup**
  - [x] 2.1 Add `@microsoft/tui-test` and `node-pty` to devDependencies
  - [x] 2.2 Create `packages/cli/src/tui/test-utils.ts` for TUI-specific helpers
  - [x] 2.3 Set up Vitest snapshot configuration for terminal output
- [x] **Phase 3 — Unit & Integration Tests**
  - [x] 3.1 Convert existing `layout.test.ts` to use new snapshot helpers
  - [x] 3.2 Add interactive tests for the command palette
- [x] **Phase 4 — E2E TUI Tests**
  - [x] 4.1 Implement full-flow test: Start daemon -> Open TUI -> Navigate tabs -> Quit
  - [x] 4.2 Add TUI snapshot tests for different terminal sizes (responsive design)

## Overview

The current TUI testing in Datacenter Tycoon is limited to testing pure rendering functions. We lack infrastructure to test the interactive elements of the TUI (keypresses, palette history, navigation) and to verify the visual layout as rendered in a real terminal environment. This plan introduces `@microsoft/tui-test` for E2E testing and enhanced snapshot testing for unit-level TUI components.

## Architecture

```mermaid
flowchart TD
    TUI[TUI App] --> Layout[Layout Engine]
    TUI --> Palette[Command Palette]
    
    subgraph Testing
        Vitest[Vitest Runner]
        TUITest[@microsoft/tui-test]
        NodePTY[node-pty / xterm.js]
        
        Vitest --> TUITest
        TUITest --> NodePTY
        NodePTY --> TUI
        
        Vitest -- Snapshots --> Layout
    end
```

Key Decisions:
- **`@microsoft/tui-test`**: Used for E2E testing. It spins up a real terminal environment, allowing us to test raw mode interactions and ANSI escape sequences.
- **Cross-Platform Support**: While the library supports Windows, macOS, and Linux, it relies on `node-pty` which contains native C++ components.
- **Snapshot Testing**: We will capture the raw string output (including ANSI codes) or a "stripped" version (plain text) to verify layout integrity.
- **Mocking Process**: `process.stdin` and `process.stdout` will be mocked or wrapped to facilitate automated input injection.

## OS Compatibility & Environment Requirements

This infrastructure relies on **native C++ bindings** via `node-pty`.

| OS | Status | Requirements |
|----|--------|--------------|
| **macOS** | ✅ Supported | Xcode Command Line Tools. |
| **Linux** | ✅ Supported | `build-essential` (`gcc`, `g++`, `make`), Python 3. |
| **Windows**| ✅ Supported | Visual Studio Build Tools (C++), Python 3. |

**CI Note**: In GitHub Actions, ensure `ubuntu-latest` has necessary build tools (usually pre-installed). If prebuilt binaries for `node-pty` fail, the build will attempt to compile from source.

The testing utility should include a check that skips TUI E2E tests or warns if `node-pty` failed to load/compile on an unsupported or misconfigured environment.

## Phase 1 — Research & Prototyping

**Goal**: Verify that `@microsoft/tui-test` can handle our custom `readline` and `node:events` based TUI loop.

### Step 1.1 — Prototype `@microsoft/tui-test` integration

- Create a temporary script `test-tui-proto.ts` that attempts to launch `packages/cli/src/tui/app.ts` inside a virtual terminal.
- Acceptance: Script successfully sends a 'q' key and the process exits.

## Phase 2 — Infrastructure Setup

**Goal**: Establish the tools and helpers needed for all TUI tests.

### Step 2.1 — Install Dependencies

- Files: `package.json`, `packages/cli/package.json`
- Install `@microsoft/tui-test` and `node-pty`.
- Acceptance: `npm install` completes successfully.

### Step 2.2 — Create TUI Test Utils

- File: `packages/cli/src/tui/test-utils.ts`
- Implement OS-compatibility guard: Export a `isTuiTestSupported()` helper that checks if `node-pty` can be imported.
- Implement `renderToMetadata()`: A helper that strips ANSI codes for easy text-based snapshots.
- Implement `injectKeyPress(stdin, key)`: Helper to simulate `readline` key events.
- Acceptance: Utils are importable in `.test.ts` files and skip tests gracefully on missing dependencies.

## Phase 3 — Unit & Integration Tests

**Goal**: Improve coverage of the interactive components of the CLI.

### Step 3.1 — Enhance Layout Snapshots

- File: `packages/cli/src/tui/layout.test.ts`
- Update tests to use `expect(renderLayout(...)).toMatchSnapshot()`.
- Acceptance: `npm run test` generates and passes snapshots.

### Step 3.2 — Test Command Palette

- File: `packages/cli/src/tui/palette.test.ts`
- Add tests for `autocomplete`, `history navigation` (up/down), and `splitCommandLine`.
- Acceptance: 100% coverage of `palette.ts`.

## Phase 4 — E2E TUI Tests

**Goal**: Full-system verification of the TUI experience.

### Step 4.1 — Implement E2E Flow

- File: `packages/cli/src/tui/e2e.test.ts`
- Test: 
  1. Start Mock Daemon.
  2. Launch TUI.
  3. Wait for "dashboard" text.
  4. Press "2" to switch to datacenters.
  5. Verify "Datacenters" header is visible.
  6. Press "q" to quit.
- Acceptance: Test passes in CI (headless).

## References

- [Microsoft TUI Test GitHub](https://github.com/microsoft/tui-test)
- [Ink Testing Library (Reference)](https://github.com/vadimdemedes/ink-testing-library)

## Changelog

- 2026-05-02 — Created plan.
