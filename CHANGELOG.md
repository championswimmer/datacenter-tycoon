# Changelog

## Unreleased

### Changed
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
