# Plans

Numbered, phased implementation plans for Datacenter Tycoon.

See [`.agents/skills/planning/SKILL.md`](../.agents/skills/planning/SKILL.md) for the full format and workflow.

## Index

- [`016-regional-fabric-and-pooled-capacity.md`](./016-regional-fabric-and-pooled-capacity.md) — Add a region-local fabric investment layer that pools connected datacenter capacity for contract fulfilment. _status: created_
- [`018-map-based-region-selector.md`](./018-map-based-region-selector.md) — Overhaul the region selection mechanism to feature an interactive world map and a sortable list of 8 realistic top-tier cloud regions with city names and codes. _status: started_
- [`037-subticks.md`](./037-subticks.md) — Introduce day-level subticks beneath monthly ticks for repairs, SLA accounting, and other lightweight intra-month simulation. _status: completed_
- [`037-web-ui-performance-optimisation.md`](./037-web-ui-performance-optimisation.md) — Audit and optimise the React web UI for render frequency, derived-data churn, DOM size, persistence jank, and asset weight. _status: created_
- [`037-core-game-logic-performance-optimisation.md`](./037-core-game-logic-performance-optimisation.md) — Profile and optimise core game-logic hot paths across tick processing, capacity queries, state lookups, and derived views. _status: created_
- [`038-backend-leaderboard-foundation.md`](./038-backend-leaderboard-foundation.md) — Build the first deployable backend for username registration, top-level leaderboard submissions, and Railway-hosted infrastructure. _status: created_
- [`039-game-balance-repair-and-contract-mix.md`](./039-game-balance-repair-and-contract-mix.md) — Rebalance repair durations, maintenance staffing impact, unrestricted contract availability, and late-game GPU/non-GPU market variety. _status: started_

## Archive

Completed plans have been moved to [`./archive`](./archive/README.md) so the active index stays focused on in-progress work. The archived files are kept for historical reference.

## Related plan guidance

- If future work touches **contract availability, term mix, SLA penalties, reputation, or player-facing contract explanations**, read [`021-reliability-score-and-contract-slas.md`](./archive/021-reliability-score-and-contract-slas.md) first. It establishes the persisted reliability loop that now shapes market refresh volume, contract-term bias, save data, and web UI copy.
- If future work touches **time semantics, day-level repair, daily SLA sampling, month-end settlement, tick drivers, or daemon clocking**, read [`037-subticks.md`](./037-subticks.md) first. It defines the intended split between lightweight daily subticks and heavyweight monthly ticks.
- If future work touches **power budgeting, rack activity/billing, or datacenter power UI semantics**, read [`022-rack-usage-based-billing.md`](./archive/022-rack-usage-based-billing.md) first. It defines the canonical reserved-vs-billed power vocabulary and deterministic allocation model used by both game logic and web selectors.
- If future work touches **web startup flow, tutorial timing, saved-game entry UX, contract-assignment clicks, or rack-placement clicks**, read [`024-web-start-screen-and-one-click-actions.md`](./archive/024-web-start-screen-and-one-click-actions.md) first. It establishes the intended banner-first entry flow and the current “click is commit” interaction pattern for contracts and rack installation.
- If future work touches **contract generation, assignment eligibility, region whitelists, or contract geography shown in CLI/web**, read [`034-contract-region-affinity.md`](./archive/034-contract-region-affinity.md) first. It defines the implemented contract-region whitelist model and the cross-package presentation/validation responsibilities.
- If future work touches **shared derived gameplay answers** like contract fit, capacity availability, live/history bucketing, maintenance affordances, move-target discovery, or upgrade affordances/effective infrastructure views, read [`035-shared-gameplay-query-surface.md`](./archive/035-shared-gameplay-query-surface.md) first. It defines the boundary between consumer formatting and authoritative `game-logic` queries.
- If future work touches **datacenter upgrades, effective facility capacities, cooling/network/power retrofit progression, generator-vs-grid accounting, or fiber-fabric eligibility**, read [`036-datacenter-upgrade-framework.md`](./archive/036-datacenter-upgrade-framework.md) first. It defines the base-vs-effective infrastructure model, the catalog-driven upgrade-track architecture, and the rule that future upgrades extend catalog tracks instead of patching `Datacenter.spec` or UI-local helpers.
- Use `npm run audit:query-boundary` after touching `web` or `cli` contract/capacity/move code. It greps for common signs that gameplay interpretation has leaked back out of `game-logic`.

## Conventions

- Filename: `NNN-kebab-slug.md` (zero-padded, sequential).
- YAML frontmatter with `name`, `description`, `status` (`created` | `started` | `completed`), `created`, `updated`.
- Progress checklist at the top, phases and steps below, mermaid diagrams in the Architecture section.
