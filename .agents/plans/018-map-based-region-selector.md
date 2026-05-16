---
name: Map-Based Region Selector
description: Overhaul the region selection mechanism to feature an interactive world map and a sortable list of 8 realistic top-tier cloud regions with city names and codes.
status: started
created: 2026-05-05
updated: 2026-05-17
---

## Progress

- [x] **Phase 1 — Game Logic & Region Model Update**
  - [x] 1.1 Update `Region` interface in `packages/game-logic/src/types.ts` to include `code: string`, `city: string`, and `coordinates: { x: number; y: number }` (representing X/Y percentages for map overlay).
  - [x] 1.2 Replace `REGION_CATALOG` in `packages/game-logic/src/catalog/regions.ts` with 8 new realistic regions (incorporating precise region IDs, names, cities, codes, and map coordinates).
  - [x] 1.3 Update test fixtures across the monorepo (`game-logic`, `web`, `cli`) replacing hardcoded IDs like `iowa` or `silicon_valley` with `us_east` or `us_west`.

- [x] **Phase 2 — UI: World Map Visualization Component**
  - [x] 2.1 Add a lightweight, open-source world map SVG as a component in `packages/web/src/ui/map/WorldMap.tsx`.
  - [x] 2.2 Implement the `WorldMap` component to receive a list of regions, mapping them to visually distinct overlay markers based on their absolute X/Y percentages.
  - [x] 2.3 Wire up marker interaction so clicking a marker triggers `onSelectRegion(regionId)` and visually highlights the selected node.

- [x] **Phase 3 — UI: Sortable List & MapView Refactor**
  - [x] 3.1 Create `packages/web/src/ui/map/RegionTable.tsx` to display regions in a tabular format, showing the 3-digit Code, City, Region Name, Power Cost, Total Power, Total Staff, and Tax Rate. Ensure the columns are sortable.
  - [x] 3.2 Refactor `packages/web/src/ui/map/MapView.tsx` (and `.module.css`) to lay out both the interactive `WorldMap` and the new sortable `RegionTable` side-by-side or stacked cleanly.
  - [x] 3.3 Ensure bidirectional synchronization: selecting a region on the map updates the table highlight, and selecting a row in the table updates the map highlight. Triggering a selection from either must successfully open the `RegionPanel`.

- [ ] **Phase 4 — Formatting & CLI Updates**
  - [x] 4.1 Update `RegionPanel` in `packages/web/src/ui/map/RegionPanel.tsx` and datacenter info cards to display the new City and 3-digit Code prominently alongside the Region name.
  - [ ] 4.2 Review `packages/cli` commands (e.g. `dct build-dc`, `dct ls`) and the TUI screens to ensure the new 3-digit region codes or city names are cleanly integrated where regional info is displayed.

## Overview

The current UI relies on a basic grid of generic datacenter regions. To increase strategic depth and realism, this plan replaces the old regions with 8 prime real-world locations modeled after the major cloud providers (AWS, GCP, Azure). It introduces a visual World Map UI for geographic context and a sortable table for economic comparison. The data model is also being enriched to include 3-digit location codes (e.g., IAD, FRA) and City names.

## Architecture

```mermaid
flowchart TD
    MapView[MapView UI]
    WorldMap[WorldMap (SVG + Markers)]
    RegionTable[Sortable Region Table]
    State[(Game State: Regions)]
    
    State --> MapView
    MapView --> WorldMap
    MapView --> RegionTable
    WorldMap -->|Click Marker| MapView
    RegionTable -->|Click Row| MapView
```

Key decisions:
- Map coordinates will use percentage-based positioning (`0-100`) from the top-left of a standard SVG projection. This avoids heavy mapping libraries while ensuring markers stay accurate regardless of viewport scaling.
- Old regions will be destructively overwritten.
- We are adopting 3-digit codes (similar to airport/IATA codes commonly used by datacenters) and concrete City names to give the UI an authentic feel.

The 8 new regions will be:
1. **US East** — Ashburn (Code: `IAD`, x: ~26%, y: ~35%)
2. **US West** — Boardman (Code: `PDX`, x: ~15%, y: ~33%)
3. **EU West** — Dublin (Code: `DUB`, x: ~44%, y: ~28%)
4. **EU Central** — Frankfurt (Code: `FRA`, x: ~48%, y: ~30%)
5. **AP Northeast** — Tokyo (Code: `NRT`, x: ~88%, y: ~36%)
6. **AP Southeast** — Singapore (Code: `SIN`, x: ~79%, y: ~55%)
7. **SA East** — São Paulo (Code: `GRU`, x: ~33%, y: ~65%)
8. **ME Central** — Dubai (Code: `DXB`, x: ~61%, y: ~43%)

## Phase 1 — Game Logic & Region Model Update

**Goal**: Extend the Region type with city, code, and coordinates, and instantiate the 8 new top-tier locations.

### Step 1.1 — Update `Region` interface

- File: `packages/game-logic/src/types.ts`
- Add `code: string`, `city: string`, and `coordinates: { x: number; y: number }` to the `Region` interface.
- Acceptance: TypeScript flags errors in `REGION_CATALOG` due to missing properties.

### Step 1.2 — Replace `REGION_CATALOG`

- File: `packages/game-logic/src/catalog/regions.ts`
- Clear the current 10 items and populate with the 8 new regions defined in the Architecture overview. Balance their power costs, tax rates, and staff wages accordingly.
- Acceptance: `REGION_CATALOG` exports exactly 8 compliant region objects.

### Step 1.3 — Fix Tests & Hardcoded References

- Files: `packages/game-logic/src/integration.test.ts`, `packages/cli/src/commands/build-dc.test.ts`, `packages/cli/src/daemon/e2e.test.ts`, etc.
- Hunt down references to `iowa`, `silicon_valley`, etc., replacing them with valid IDs from the new catalog (e.g., `us_east`).
- Acceptance: `npm run test` passes across all packages.

## Phase 2 — UI: World Map Visualization Component

**Goal**: Introduce an SVG-based geographic selector.

### Step 2.1 — Add WorldMap component and SVG

- File: `packages/web/src/ui/map/WorldMap.tsx`
- Obtain a free, CC0 or MIT-licensed vector map and embed it. Create the `WorldMap` component shell.
- Acceptance: Component is accessible and rendering an SVG outline of the world.

### Step 2.2 — Overlay Markers

- File: `packages/web/src/ui/map/WorldMap.tsx`
- Take a `regions` prop. Render styled marker div/svg elements mapped over the SVG using absolute percentage positioning based on `region.coordinates`.
- Acceptance: The 8 regions visibly appear at correct relative positions globally.

### Step 2.3 — Map Interaction

- File: `packages/web/src/ui/map/WorldMap.tsx`
- Pass `selectedRegionId` and `onSelectRegion(id)` props. Ensure clicking a marker triggers selection and conditionally style the active marker.
- Acceptance: Clicking a dot calls the prop; selected dot looks distinctly active.

## Phase 3 — UI: Sortable List & MapView Refactor

**Goal**: Display a sortable economic overview table and unify the layout.

### Step 3.1 — Create RegionTable component

- File: `packages/web/src/ui/map/RegionTable.tsx`
- Create a data table accepting `regions`, sorting state logic, and an `onSelectRegion(id)` callback. Render `[Code, City, Name, Cost/kWh, Power, Staff, Tax]`.
- Acceptance: Clicking column headers correctly toggles sorting by numeric/string value.

### Step 3.2 — Refactor MapView

- File: `packages/web/src/ui/map/MapView.tsx` (and CSS)
- Remove the old grid block layout. Integrate `<WorldMap />` and `<RegionTable />`.
- Acceptance: Both components render.

### Step 3.3 — Wiring & Polish

- File: `packages/web/src/ui/map/MapView.tsx`
- Tie local state for `selectedRegionId` to both child components.
- Acceptance: Visual parity in selection state between Map and Table.

## Phase 4 — Formatting & CLI Updates

**Goal**: Ensure the new fields (City, Code) enrich the broader application experience.

### Step 4.1 — Enhance RegionPanel

- File: `packages/web/src/ui/map/RegionPanel.tsx`
- Update the header/body to include the `region.code` and `region.city` prominently.
- Acceptance: When viewing regional details, City and Code are visible.

### Step 4.2 — Review CLI Displays

- Search for places in `packages/cli/src` (like TUI screens or table outputs) that display `region.name`. 
- Incorporate `region.code` for denser terminal output.
- Acceptance: Terminal views utilize the new codes for a cleaner aesthetic.

## References

- [AGENTS.md](../AGENTS.md)

## Changelog

- 2026-05-05 — Created initial plan.
- 2026-05-05 — Refined plan to add 3-digit codes (IAD, PDX, etc.) and city names to the `Region` model, and added Phase 4 for UI/CLI display integration.
- 2026-05-17 — Completed Step 3.1 by adding a sortable `RegionTable` component and focused coverage for its sort/selection behaviour.
- 2026-05-17 — Completed Step 3.2 by refactoring `MapView` into a two-panel map/economics layout and embedding the region detail panel alongside the world map.
- 2026-05-17 — Completed Step 3.3 by wiring shared selection state through the map/table pair and adding coverage for synchronized selection + region panel opening.
- 2026-05-17 — Completed Step 4.1 by surfacing region codes and cities in the region detail panel plus datacenter-facing web headers/cards.
