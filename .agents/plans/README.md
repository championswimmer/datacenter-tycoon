# Plans

Numbered, phased implementation plans for Datacenter Tycoon.

See [`.agents/skills/planning/SKILL.md`](../.agents/skills/planning/SKILL.md) for the full format and workflow.

## Index

- [`001-initial-game-logic.md`](./001-initial-game-logic.md) — first-draft deterministic core (entities, catalogs, capacity, economy, contracts, tick). _status: created_
- [`002-web-frontend-mvp.md`](./002-web-frontend-mvp.md) — initial React+Vite web UI with neon control-center theme, rack grid, contracts, and live stats. _status: created_
- [`015-rack-aging-failures-and-maintenance.md`](./015-rack-aging-failures-and-maintenance.md) — age-based rack failures, automatic repairs, and a maintenance staffing lever. _status: created_
- [`016-regional-fabric-and-pooled-capacity.md`](./016-regional-fabric-and-pooled-capacity.md) — region-local fabric investment and pooled capacity for contract fulfilment. _status: created_
- [`018-mobile-responsive-ux.md`](./018-mobile-responsive-ux.md) — responsive web UX plan for collapsible mobile panels, portrait rack layouts, scroll-safe modals, and touch-friendly controls. _status: created_
- [`021-reliability-score-and-contract-slas.md`](./021-reliability-score-and-contract-slas.md) — player reliability scoring, SLA-driven reputation changes, and reliability-shaped contract frequency and term length. _status: completed_
- [`022-rack-usage-based-billing.md`](./022-rack-usage-based-billing.md) — split rack power reservation from active-vs-idle power billing with deterministic rack activity allocation. _status: completed_
- [`024-web-start-screen-and-one-click-actions.md`](./024-web-start-screen-and-one-click-actions.md) — banner-first start screen plus click-to-confirm contract assignment and rack placement. _status: created_
- [`026-cli-command-grouping-and-contract-guardrails.md`](./026-cli-command-grouping-and-contract-guardrails.md) — enforce contract-fit rejection, unify contract JSON naming, make `--json` universal, and replace flat CLI verbs with grouped resource commands. _status: completed_
- [`034-contract-region-affinity.md`](./034-contract-region-affinity.md) — add optional EU/Asia/USA region-affinity whitelists for contracts across game-logic, CLI, and web. _status: created_

## Related plan guidance

- If future work touches **contract availability, term mix, SLA penalties, reputation, or player-facing contract explanations**, read [`021-reliability-score-and-contract-slas.md`](./021-reliability-score-and-contract-slas.md) first. It establishes the persisted reliability loop that now shapes market refresh volume, contract-term bias, save data, and web UI copy.
- If future work touches **power budgeting, rack activity/billing, or datacenter power UI semantics**, read [`022-rack-usage-based-billing.md`](./022-rack-usage-based-billing.md) first. It defines the canonical reserved-vs-billed power vocabulary and deterministic allocation model used by both game logic and web selectors.
- If future work touches **web startup flow, tutorial timing, saved-game entry UX, contract-assignment clicks, or rack-placement clicks**, read [`024-web-start-screen-and-one-click-actions.md`](./024-web-start-screen-and-one-click-actions.md) first. It establishes the intended banner-first entry flow and the current “click is commit” interaction pattern for contracts and rack installation.
- If future work touches **contract generation, assignment eligibility, region whitelists, or contract geography shown in CLI/web**, read [`034-contract-region-affinity.md`](./034-contract-region-affinity.md) first. It defines the planned contract-region whitelist model and the cross-package presentation/validation responsibilities.

## Conventions

- Filename: `NNN-kebab-slug.md` (zero-padded, sequential).
- YAML frontmatter with `name`, `description`, `status` (`created` | `started` | `completed`), `created`, `updated`.
- Progress checklist at the top, phases and steps below, mermaid diagrams in the Architecture section.
