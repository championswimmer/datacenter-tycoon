# Plans

Numbered, phased implementation plans for Datacenter Tycoon.

See [`../skills/planning/SKILL.md`](../skills/planning/SKILL.md) for the full format and workflow.

## Index

- [041 — Regional OpEx and Starting Cash Rebalance](./041-regional-opex-and-starting-cash-rebalance.md) — status: created
- [042 — Online Identity, CLI Leaderboard Sync, and Development DB Modes](./042-online-identity-cli-sync-and-dev-db-modes.md) — status: created
- [043 — Server Migration to Bun, Elysia, and Drizzle](./043-server-migration-to-bun-elysia-and-drizzle.md) — status: created

## Archive

Completed plans have been moved to [`./archive`](./archive/README.md) so the active index stays focused on in-progress work. The archived files are kept for historical reference, including the completed rack/unit-economics rebalance plan (`040`).

## Related plan guidance

- If future work touches **contract availability, term mix, SLA penalties, reputation, or player-facing contract explanations**, read [`021-reliability-score-and-contract-slas.md`](./archive/021-reliability-score-and-contract-slas.md) first. It establishes the persisted reliability loop that now shapes market refresh volume, contract-term bias, save data, and web UI copy.
- If future work touches **time semantics, day-level repair, daily SLA sampling, month-end settlement, tick drivers, or daemon clocking**, read [`037-subticks.md`](./archive/037-subticks.md) first. It defines the intended split between lightweight daily subticks and heavyweight monthly ticks.
- If future work touches **power budgeting, rack activity/billing, or datacenter power UI semantics**, read [`022-rack-usage-based-billing.md`](./archive/022-rack-usage-based-billing.md) first. It defines the canonical reserved-vs-billed power vocabulary and deterministic allocation model used by both game logic and web selectors.
- If future work touches **web startup flow, tutorial timing, saved-game entry UX, contract-assignment clicks, or rack-placement clicks**, read [`024-web-start-screen-and-one-click-actions.md`](./archive/024-web-start-screen-and-one-click-actions.md) first. It establishes the intended banner-first entry flow and the current “click is commit” interaction pattern for contracts and rack installation.
- If future work touches **contract generation, assignment eligibility, region whitelists, or contract geography shown in CLI/web**, read [`034-contract-region-affinity.md`](./archive/034-contract-region-affinity.md) first. It defines the implemented contract-region whitelist model and the cross-package presentation/validation responsibilities.
- If future work touches **online identity, leaderboard transport, backend persistence modes, CLI↔server score sync, localhost-vs-production API configuration, or server-stack migration to Bun/Elysia/Drizzle**, read [`038-backend-leaderboard-foundation.md`](./archive/038-backend-leaderboard-foundation.md), [`042-online-identity-cli-sync-and-dev-db-modes.md`](./042-online-identity-cli-sync-and-dev-db-modes.md), and [`043-server-migration-to-bun-elysia-and-drizzle.md`](./043-server-migration-to-bun-elysia-and-drizzle.md) first. Together they define the current server API surface, the follow-on online integration work, and the planned runtime/framework/ORM migration.
- If future work touches **shared derived gameplay answers** like contract fit, capacity availability, live/history bucketing, maintenance affordances, move-target discovery, or upgrade affordances/effective infrastructure views, read [`035-shared-gameplay-query-surface.md`](./archive/035-shared-gameplay-query-surface.md) first. It defines the boundary between consumer formatting and authoritative `game-logic` queries.
- If future work touches **datacenter upgrades, effective facility capacities, cooling/network/power retrofit progression, generator-vs-grid accounting, or fiber-fabric eligibility**, read [`036-datacenter-upgrade-framework.md`](./archive/036-datacenter-upgrade-framework.md) first. It defines the base-vs-effective infrastructure model, the catalog-driven upgrade-track architecture, and the rule that future upgrades extend catalog tracks instead of patching `Datacenter.spec` or UI-local helpers.
- Use `npm run audit:query-boundary` after touching `web` or `cli` contract/capacity/move code. It greps for common signs that gameplay interpretation has leaked back out of `game-logic`.

## Conventions

- Filename: `NNN-kebab-slug.md` (zero-padded, sequential).
- YAML frontmatter with `name`, `description`, `status` (`created` | `started` | `completed`), `created`, `updated`.
- Progress checklist at the top, phases and steps below, mermaid diagrams in the Architecture section.
