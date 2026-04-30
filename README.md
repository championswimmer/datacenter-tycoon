# Datacenter Tycoon

A tycoon game about building data centers, buying racks, managing capex/opex, and fulfilling compute/memory/storage/GPU contracts.

## Monorepo Structure

This is a TypeScript monorepo using npm workspaces.

- **`packages/game-logic`** — Core game logic library (pure TS, framework-agnostic). All game rules, state, simulation, and economy live here.
- **`packages/web`** — Web app frontend of the game.
- **`packages/desktop`** — Electron app wrapper (planned).
- **`packages/server`** — Backend for scoring, leaderboards, and future multiplayer.

## Getting Started

```bash
npm install
npm run build
npm run dev
```

## Game Concept

Players build and operate data centers:
- **Build**: Construct datacenters, fill them with racks (compute, memory, storage, GPU).
- **Manage**: Balance **capex** (hardware, construction) against **opex** (power, cooling, staff).
- **Earn**: Fulfill **contracts** that demand specific capacities of compute, memory, storage, and GPU resources.

See [AGENTS.md](./AGENTS.md) for guidance when working on this codebase with AI agents.
