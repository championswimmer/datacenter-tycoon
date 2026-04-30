# AGENTS.md — `@datacenter-tycoon/game-logic`

The deterministic, framework-agnostic core of the game.

## Hard Rules

- **No DOM. No Node-only APIs (no `fs`, no `process`). No Electron. No React.**
  This package must run in any JS runtime.
- **Deterministic**: any randomness goes through an injected seeded PRNG. Never call `Math.random()` directly in simulation code.
- **Pure where possible**: prefer pure functions `(state, action) => state`. Mutations stay isolated.
- **Serializable state**: all game state must round-trip through `JSON.stringify` / `JSON.parse`. No `Date` objects, `Map`, `Set`, or class instances in stored state — use plain objects, arrays, numbers, strings, booleans.
- **Time is a number**: simulation time is an integer tick count, not wall-clock.

## Suggested Module Layout (build out as needed)

```
src/
├── index.ts              # public exports
├── types.ts              # shared domain types
├── entities/
│   ├── datacenter.ts
│   ├── rack.ts
│   └── server.ts
├── economy/
│   ├── capex.ts
│   └── opex.ts
├── contracts/
│   └── contract.ts
├── sim/
│   ├── tick.ts           # advance simulation by one tick
│   └── rng.ts            # seeded PRNG
└── save/
    └── serialize.ts
```

## Testing

Use `node:test` + `tsx`. Tests sit next to source as `*.test.ts`. Cover: economy math, contract fulfillment, tick determinism (same seed → same state).

## Public API

Only export from `src/index.ts`. Treat anything not re-exported as internal.
