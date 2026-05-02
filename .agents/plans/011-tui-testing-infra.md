---
name: TUI Testing Infrastructure
description: Implement robust TUI testing with virtual terminals, automated interactions, and snapshot testing.
status: created
created: 2026-05-02
updated: 2026-05-02
owner: cli
---

## Progress

- [ ] **Phase 1 — Research & Prototyping**
  - [ ] 1.1 Prototype `@microsoft/tui-test` integration for E2E
  - [ ] 1.2 Evaluate `ink-testing-library` style pure-render tests for layout units
- [ ] **Phase 2 — Infrastructure Setup**
  - [ ] 2.1 Add `@microsoft/tui-test` and `node-pty` to devDependencies
  - [ ] 2.2 Create `packages/cli/src/tui/test-utils.ts` for TUI-specific helpers
  - [ ] 2.3 Set up Vitest snapshot configuration for terminal output
- [ ] **Phase 3 — Unit & Integration Tests**
  - [ ] 3.1 Convert existing `layout.test.ts` to use new snapshot helpers
  - [ ] 3.2 Add interactive tests for the command palette
- [ ] **Phase 4 — E2E TUI Tests**
  - [ ] 4.1 Implement full-flow test: Start daemon -> Open TUI -> Navigate tabs -> Quit
  - [ ] 4.2 Add TUI snapshot tests for different terminal sizes (responsive design)

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
- **Snapshot Testing**: We will capture the raw string output (including ANSI codes) or a "stripped" version (plain text) to verify layout integrity.
- **Mocking Process**: `process.stdin` and `process.stdout` will be mocked or wrapped to facilitate automated input injection.

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
- Implement `renderToMetadata()`: A helper that strips ANSI codes for easy text-based snapshots.
- Implement `injectKeyPress(stdin, key)`: Helper to simulate `readline` key events.
- Acceptance: Utils are importable in `.test.ts` files.

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
