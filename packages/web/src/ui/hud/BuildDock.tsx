import { useMemo, useState } from "react";
import {
  RACK_CATALOG,
  type RackKind,
  type RackSpec,
} from "@datacenter-tycoon/game-logic";
import { selectCash } from "../../store/selectors.js";
import { useSelector } from "../../store/storeContext.js";
import { RACK_KIND_PALETTES } from "../../engine/rackModels3d.js";
import type { ActiveDrawer, BuildTool, CameraViewMode } from "../../state/viewportState.js";
import styles from "./BuildDock.module.css";

export interface BuildDockProps {
  viewMode: CameraViewMode;
  buildTool: BuildTool;
  activeDrawer: ActiveDrawer;
  onSelectTool: (tool: BuildTool) => void;
  onToggleDrawer: (drawer: Exclude<ActiveDrawer, "none">) => void;
  onOpenBuildDcModal: () => void;
}

const KIND_ORDER: { kind: RackKind; label: string }[] = [
  { kind: "compute", label: "Compute" },
  { kind: "memory", label: "Memory" },
  { kind: "storage", label: "Storage" },
  { kind: "gpu", label: "GPU" },
];

const DRAWER_BUTTONS: { id: Exclude<ActiveDrawer, "none">; label: string; icon: string }[] = [
  { id: "contracts", label: "Contracts", icon: "📋" },
  { id: "finances", label: "Finances", icon: "💹" },
  { id: "upgrades", label: "Power & Upgrades", icon: "⚡" },
  { id: "map", label: "World Map", icon: "🌍" },
  { id: "log", label: "Ledger Log", icon: "📜" },
];

function primaryCapacityLabel(spec: RackSpec): string {
  switch (spec.kind) {
    case "compute":
      return `${spec.vCpu} vCPU`;
    case "memory":
      return `${spec.ramGb} GB`;
    case "storage":
      return `${spec.storageTb} TB`;
    case "gpu":
      return `${spec.gpuFlops} TF`;
  }
}

export function BuildDock({
  viewMode,
  buildTool,
  activeDrawer,
  onSelectTool,
  onToggleDrawer,
  onOpenBuildDcModal,
}: BuildDockProps) {
  const cash = useSelector(selectCash);
  const [openKind, setOpenKind] = useState<RackKind | null>(null);

  const racksByKind = useMemo(() => {
    const all = Object.values(RACK_CATALOG);
    return {
      compute: all.filter((s) => s.kind === "compute").sort((a, b) => a.tier - b.tier),
      memory: all.filter((s) => s.kind === "memory").sort((a, b) => a.tier - b.tier),
      storage: all.filter((s) => s.kind === "storage").sort((a, b) => a.tier - b.tier),
      gpu: all.filter((s) => s.kind === "gpu").sort((a, b) => a.tier - b.tier),
    } satisfies Record<RackKind, RackSpec[]>;
  }, []);

  const traySpecs = openKind ? racksByKind[openKind] : [];

  return (
    <div className={styles.container}>
      {openKind && viewMode === "facility" && (
        <div className={styles.rackTray} role="region" aria-label={`${openKind} rack brush palette`}>
          <div className={styles.trayHeader}>
            <span>SELECT {openKind.toUpperCase()} TIER BRUSH</span>
            <button type="button" className={styles.closeTrayBtn} onClick={() => setOpenKind(null)}>
              ✕
            </button>
          </div>
          <div className={styles.trayGrid}>
            {traySpecs.map((spec) => {
              const selected =
                buildTool.mode === "place_rack" && buildTool.specId === spec.id;
              const affordable = cash >= spec.capexCost;
              const palette = RACK_KIND_PALETTES[spec.kind];
              return (
                <button
                  key={spec.id}
                  type="button"
                  aria-pressed={selected}
                  className={[
                    styles.rackCard,
                    selected ? styles.rackCardSelected : "",
                    !affordable ? styles.rackCardUnaffordable : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ borderColor: selected ? palette.accent : undefined }}
                  onClick={() => onSelectTool({ mode: "place_rack", specId: spec.id })}
                >
                  <div className={styles.rackCardTop}>
                    <span className={styles.rackId} style={{ color: palette.accent }}>
                      {spec.id}
                    </span>
                    <span className={styles.rackTier}>T{spec.tier}</span>
                  </div>
                  <div className={styles.rackCap}>{primaryCapacityLabel(spec)}</div>
                  <div className={styles.rackMeta}>
                    ${(spec.capexCost / 1_000).toFixed(0)}K · {spec.powerDrawKw}kW
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className={styles.dock} aria-label="Build & Management Dock">
        <div className={styles.toolGroup}>
          <button
            type="button"
            aria-pressed={buildTool.mode === "select"}
            className={[styles.toolBtn, buildTool.mode === "select" ? styles.toolBtnActive : ""].filter(Boolean).join(" ")}
            onClick={() => {
              setOpenKind(null);
              onSelectTool({ mode: "select" });
            }}
          >
            🔍 Inspect
          </button>

          {viewMode === "facility" ? (
            <>
              {KIND_ORDER.map((entry) => {
                const isKindActive =
                  openKind === entry.kind ||
                  (buildTool.mode === "place_rack" && RACK_CATALOG[buildTool.specId]?.kind === entry.kind);
                return (
                  <button
                    key={entry.kind}
                    type="button"
                    aria-pressed={isKindActive}
                    className={[styles.toolBtn, isKindActive ? styles.toolBtnActive : ""].filter(Boolean).join(" ")}
                    onClick={() => {
                      const next = openKind === entry.kind ? null : entry.kind;
                      setOpenKind(next);
                      if (next && buildTool.mode !== "place_rack") {
                        const firstSpec = racksByKind[next][0];
                        if (firstSpec) {
                          onSelectTool({ mode: "place_rack", specId: firstSpec.id });
                        }
                      }
                    }}
                  >
                    <span
                      className={styles.kindDot}
                      style={{ backgroundColor: RACK_KIND_PALETTES[entry.kind].accent }}
                    />
                    {entry.label}
                  </button>
                );
              })}

              <button
                type="button"
                aria-pressed={buildTool.mode === "bulldozer"}
                className={[styles.toolBtn, buildTool.mode === "bulldozer" ? styles.bulldozerActive : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  setOpenKind(null);
                  onSelectTool({ mode: "bulldozer" });
                }}
              >
                🚧 Bulldoze
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.buildDcBtn}
              onClick={onOpenBuildDcModal}
            >
              🏗 Build Facility
            </button>
          )}
        </div>

        <div className={styles.divider} />

        <div className={styles.drawerGroup}>
          {DRAWER_BUTTONS.map((btn) => {
            const active = activeDrawer === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                aria-pressed={active}
                className={[styles.drawerBtn, active ? styles.drawerBtnActive : ""].filter(Boolean).join(" ")}
                onClick={() => onToggleDrawer(btn.id)}
              >
                <span>{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
