# AGENTS.md — `@datacenter-tycoon/game-logic`

The deterministic, framework-agnostic core of Datacenter Tycoon.

This package now contains the full first-pass playable core: catalogs, placement validation, economy, contracts, simulation tick, reducer, new-game factory, save/load, integration tests, and public README.

## Hard Rules

- **No DOM. No Node-only APIs in runtime logic** (`fs`, `process`, etc.).
  This package must run in browser, Node, and future desktop builds.
- **Deterministic only**: all randomness must flow through the seeded PRNG in `src/sim/rng.ts`. Never call `Math.random()` in simulation code.
- **Prefer pure state transitions**: model gameplay as `(state, action) => state` and pure helpers.
- **Serializable state**: stored game state must round-trip through JSON with plain objects/arrays/primitives only.
- **Time is integer ticks**: one tick currently represents one in-game month.
- **Do not write explicit `undefined` optional fields into persisted state** unless there is a strong reason. Omit optional properties instead so save/load round-trips stay structurally stable.

## Current Module Layout

```text
src/
├── index.ts                  # public package exports
├── types.ts                  # branded IDs and shared domain types
├── integration.test.ts       # end-to-end smoke test
├── catalog/
│   ├── datacenters.ts        # datacenter blueprints
│   ├── racks.ts              # rack catalog
│   ├── index.ts
│   └── catalog.test.ts
├── contracts/
│   ├── generator.ts          # deterministic contract generation
│   ├── lifecycle.ts          # evaluate / advance contract status
│   ├── market.ts             # refresh market + accept contract
│   ├── index.ts
│   └── contracts.test.ts
├── economy/
│   ├── constants.ts          # balance constants
│   ├── capex.ts              # capex application + ledger
│   ├── opex.ts               # opex + revenue evaluation
│   ├── index.ts
│   └── economy.test.ts
├── entities/
│   ├── datacenter.ts         # aggregate usage/capacity + placement validation
│   ├── rack.ts               # rack capacity helper
│   ├── index.ts
│   └── capacity.test.ts
├── save/
│   ├── serialize.ts          # save envelope + migration stub
│   ├── index.ts
│   └── serialize.test.ts
├── sim/
│   ├── rng.ts                # seeded PRNG
│   ├── tick.ts               # monthly simulation step
│   ├── index.ts
│   └── tick.test.ts
└── state/
    ├── newGame.ts            # initial GameState factory
    ├── reduce.ts             # reducer and Action union
    ├── index.ts
    ├── newGame.test.ts
    └── reduce.test.ts
```

## Architectural Expectations

- **`src/index.ts` is the public surface.** If a symbol is intended for consumers, re-export it there via the relevant barrel.
- **Catalogs are data, not logic containers.** Keep rack/datacenter blueprints in `catalog/` as plain objects.
- **Reducer remains the main gameplay entry point.** New gameplay interactions should usually become actions in `state/reduce.ts` and delegate to small domain helpers.
- **Simulation lives in `sim/tick.ts`.** Monthly progression should be orchestrated there, not spread across UI/server code.
- **Save/load format is versioned.** Preserve `SAVE_VERSION` semantics and route format changes through `migrate()`.

## Existing Gameplay Surface

These are already implemented and should usually be extended rather than replaced:

- `newGame(seed, options?)`
- `reduce(state, action)`
- `tick(state)`
- `serialize(state)` / `deserialize(json)`
- contract market generation / refresh / acceptance
- contract lifecycle evaluation
- capex / opex / revenue ledgering
- rack placement validation via datacenter constraints

## Editing Guidelines

- When changing **public API**, update both:
  - `src/index.ts`
  - `packages/game-logic/README.md`
- When changing **save shape**, update:
  - `src/save/serialize.ts`
  - migration behavior
  - round-trip tests
- When changing **tick behavior**, verify:
  - determinism still holds
  - ledger entries remain sensible
  - integration test still passes
- When changing **contracts or economy**, keep generation and monthly outcomes deterministic for the same seed and action sequence.
- Prefer reusing existing helpers like `applyCapex`, `canPlaceRack`, `acceptContract`, `refreshContractMarket`, and `tick` rather than duplicating logic.

## Testing

Use `node:test` + `tsx`. Tests sit next to source as `*.test.ts`.

Current coverage includes:
- catalog invariants
- capacity aggregation and placement validation
- capex / opex / revenue
- contract generation / market / lifecycle
- tick determinism and monthly flow
- `newGame` and reducer behavior
- save/load round-trips and migration stub
- end-to-end integration smoke test

Run:

```bash
npm run test -w @datacenter-tycoon/game-logic
npm run typecheck -w @datacenter-tycoon/game-logic
```

## Public API Rule

Only export intended consumer-facing symbols from `src/index.ts`. Treat anything not re-exported there as internal, even if it exists in a leaf module.
