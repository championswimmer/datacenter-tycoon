# AGENTS.md (Developer Guide)

Guidance for human developers and AI coding agents contributing to **Datacenter Tycoon**. This document outlines the project requirements, code structure, architectural guidelines, and contribution rules.

## Project Overview

Datacenter Tycoon is a tycoon-style game where players build data centers, populate them with racks (compute, memory, storage, GPU), manage capex and opex, and fulfill contracts that demand specific capacities.

This is a **TypeScript monorepo** using **npm workspaces**.

## Repository Layout

```
datacenter-tycoon/
├── packages/
│   ├── game-logic/   # Core game logic (pure TS, framework-agnostic) — START HERE for rules/sim
│   ├── web/          # Web frontend
│   ├── cli/          # Local daemon + one-shot commands + interactive terminal UI
│   ├── desktop/      # Electron app (planned, not yet implemented)
│   └── server/       # Scoring, leaderboard, multiplayer backend
├── .agents/
│   ├── plans/        # Numbered implementation plans
│   └── skills/       # Project-local agent skills (SKILL.md format)
├── AGENTS.md         # (this file)
└── package.json      # Workspace root
```

Each package has its own `AGENTS.md` with package-specific guidance. Nested AGENTS.md files take precedence for files in their subtree.

## Setup & Contribution Commands

To get started with local development, clone the repository and run the following commands:

```bash
npm install                # install all workspace deps
npm run build              # build all packages
npm run typecheck          # tsc --noEmit across workspaces
npm run test               # run tests across workspaces
npm run dev                # dev mode where applicable
npm run dev:cli            # run the CLI package in watch/dev mode
```

## Code Style & Guidelines

- **Language**: TypeScript, `strict: true`. No `any` unless justified with a comment.
- **Modules**: ESM (`"type": "module"`).
- **Target**: ES2022.
- **Naming**: `camelCase` for vars/functions, `PascalCase` for types/classes, `kebab-case` for filenames.
- **Imports**: Use workspace package names (e.g. `@datacenter-tycoon/game-logic`), not relative paths across packages.
- **Purity**: `game-logic` must remain pure TypeScript — no DOM, no Node-specific APIs, no Electron, no React. It must run in browser, Node, and Electron alike.

## Architectural Rules

1. **`game-logic` is the source of truth** for all game rules, entities, simulation tick, economy, contracts, and scoring. Frontends (`web`, `desktop`) and `server` consume it; they never reimplement game rules.
2. **Deterministic simulation**: Game logic should be deterministic given a seed, to support replays, multiplayer, and testing.
3. **Serializable state**: All game state must be JSON-serializable for save/load and network sync.
4. **No circular deps** between packages. Dependency direction: `web`/`desktop`/`server` → `game-logic`.
5. **Shared gameplay queries stay in `game-logic`**. If multiple interfaces need the same derived domain answer — e.g. contract market/live/history buckets, contract-fit checks, datacenter available capacity, maintenance staffing affordances, or legal rack-move targets — add/export a read-only helper in `game-logic` and have consumers call it. Do not duplicate those reducers/filters in `web` or `cli`.

## Domain Vocabulary

- **Datacenter**: A facility containing racks. Has location, power capacity, cooling, floor space.
- **Rack**: A unit inside a datacenter, holding servers of a given type (compute / memory / storage / gpu).
- **Region**: A geographic location (state/country) where datacenters can be built. Each region has unique power costs, staff wages, tax rates, and finite power/staff resource pools.
- **Map**: The procedurally-generated set of regions available in a given game world. Deterministic per seed.
- **Capex**: One-time capital expenditure (buying hardware, building datacenters).
- **Opex**: Ongoing operational expenditure (power, cooling, staff, bandwidth).
- **Contract**: A demand for a quantity of compute / memory / storage / gpu over a time period, paying revenue if fulfilled, penalty if breached.
- **Capacity**: Aggregate compute (vCPU/FLOPS), memory (GB), storage (GB), gpu (units) available across all racks.

## Testing

- Unit tests live next to source files as `*.test.ts`.
- Game logic must have high test coverage — it's the deterministic core.
- Run `npm run test -w @datacenter-tycoon/game-logic` to test just the core.

## AI Agent Skills

Project-local agent skills live in `.agents/skills/<skill-name>/SKILL.md`. AI agents should load a skill when its description matches the current task.

- **`planning`** — how to create, structure, track, and execute phased plans under `.agents/plans/`. Load this whenever a task is non-trivial (multi-file, multi-session, architectural) or when the user asks to plan / design / scope / continue work.
- **`game-balance-tuning`** — guardrails for changing numeric balance constants.

## Development Plans

Non-trivial work is captured as numbered plans in `.agents/plans/NNN-slug.md`. Always check `.agents/plans/` for an active plan related to the current task before starting work, and update its progress checklist as you go. See the `planning` skill for the full workflow.

## When in Doubt

- Read the package-level `AGENTS.md` for the package you're editing.
- Prefer adding logic to `game-logic` over duplicating it in a frontend.
- Run `npm run audit:query-boundary` when touching contract/capacity/maintenance/move UI or CLI code to catch gameplay logic drifting back out of `game-logic`.
- Keep changes small and well-typed; favor pure functions over mutable singletons.
