# @datacenter-tycoon/web-3d

Cities: Skylines-inspired isometric 3D web frontend for **Datacenter Tycoon**.

## Features

- **City District Skyline View**: 12×12 zoned isometric city district per region with roads, intersections, animated vehicle traffic, municipal power/fiber/workforce landmarks, dynamic 3D datacenter campuses showing visual upgrades, regional optical links, and buildable vacant lots.
- **Facility 3D Cutaway View**: Raised-floor isometric cutaway showing under-floor chilled-water pipes and high-voltage conduits, cutaway CRAC/PDU/NOC rooms, animated maintenance technicians, hot/cold aisles, procedural Tier 0–3 compute/memory/storage/GPU racks, and ghost placement previews.
- **Cities: Skylines Info Overlays**: Switchable live `Standard`, `Power Grid`, `Thermal Load`, `Network Fabric`, and `Maintenance` lenses across both 3D scenes, plus 90° camera rotation (`Q`/`E`), zoom, pan, and cutaway toggles.
- **Shared Foundations**: Reuses store, selectors, persistence, online leaderboard/verified-run sync, audio engine, design tokens, and management dialogs directly from `@datacenter-tycoon/web` atop `@datacenter-tycoon/game-logic`.

## Scripts

```bash
npm run dev -w @datacenter-tycoon/web-3d
npm run build -w @datacenter-tycoon/web-3d
npm run test -w @datacenter-tycoon/web-3d
npm run typecheck -w @datacenter-tycoon/web-3d
```
