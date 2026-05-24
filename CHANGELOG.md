# Changelog

## Unreleased

### Changed
- bumped `@datacenter-tycoon/game-logic` `BALANCE_VERSION` to `8` for the regional OpEx and starting-cash rebalance
- increased default hard starting cash to `4,000,000` and easy starting cash to `8,000,000`
- derived regional electricity and staff-wage baselines from research-backed power/labor multipliers so location choice has clearer ongoing OpEx tradeoffs
- bumped `@datacenter-tycoon/game-logic` `BALANCE_VERSION` to `6` for the rack-repair and contract-market rebalance
- changed rack repairs to use rack-kind-aware targets: compute `3` days, memory `4`, storage `5`, and GPU `9` on hard difficulty before staffing bonuses apply
- kept maintenance staffing as a repair-speed multiplier so extra maintenance heads still shorten every repair class, including GPUs
- added deterministic contract-market floor rules so refreshed markets keep enough unrestricted/global offers and enough non-GPU offers even in later-stage play
- bumped `@datacenter-tycoon/game-logic` `BALANCE_VERSION` to `5` for day-level repair timing
- shortened base rack repair targets to `3` days on hard / `2.25` days on easy before staffing bonuses apply
- bumped `@datacenter-tycoon/game-logic` `BALANCE_VERSION` to `4` for the global easier-balance pass
- reduced rack recurring upkeep by `20%` across all rack families and tiers
- reduced extra maintenance-staff wages by `20%` while leaving baseline facility staffing unchanged
- added starter-tier rack SKUs `C0`, `M0`, `S0`, and `G0` at roughly half of tier-1 capacity, capex, power, and upkeep
- halved the base repair target from `90` days to `45` days before difficulty modifiers apply
- bumped `@datacenter-tycoon/game-logic` `BALANCE_VERSION` to `3` for the contract-term pricing rebalance
- long-duration contracts now apply a monthly-rate discount after the 6-month baseline so anchor/archive work trades margin for stability
- contract generation now uses workload-specific term bands, so archive and enterprise offers can run much longer than render or inference burst work
- bumped `@datacenter-tycoon/game-logic` `BALANCE_VERSION` to `2` for the cooling and rack-aging rebalance
- raised starter datacenter cooling headroom to `120k` / `520k` / `10.5M` BTU/hr for garage, warehouse, and hyperscale blueprints
- replaced the old linear rack-failure curve with a year-anchored progression that reaches `2%` at year 1, accelerates later in rack life, and caps at `60%` by year 6

## 0.1.0 — 2026-05-02

### Added
- debut of `@datacenter-tycoon/cli`
- local daemon-backed CLI client with JSON-RPC transport
- one-shot commands for status, save management, listings, datacenter/rack mutations, contracts, and time control
- interactive terminal UI with dashboard, datacenters, contracts, and catalog tabs
- command palette, help overlay, and live subscription-driven updates
- CLI integration and end-to-end test coverage
