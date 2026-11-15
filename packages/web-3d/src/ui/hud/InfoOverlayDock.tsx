import type { IsoRotation } from "../../engine/isoMath.js";
import type { InfoOverlayMode } from "../../engine/rackModels3d.js";
import type { CameraViewMode } from "../../state/viewportState.js";
import styles from "./InfoOverlayDock.module.css";

export interface InfoOverlayDockProps {
  overlayMode: InfoOverlayMode;
  rotation: IsoRotation;
  zoom: number;
  cutaway: boolean;
  viewMode: CameraViewMode;
  onSelectOverlay: (mode: InfoOverlayMode) => void;
  onRotateCCW: () => void;
  onRotateCW: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleCutaway: () => void;
}

const OVERLAY_OPTIONS: {
  id: InfoOverlayMode;
  label: string;
  hotkey: string;
  color: string;
}[] = [
  { id: "standard", label: "Standard", hotkey: "1", color: "#00f5d4" },
  { id: "power", label: "Power Grid", hotkey: "2", color: "#fbbf24" },
  { id: "thermal", label: "Thermal", hotkey: "3", color: "#fb7185" },
  { id: "network", label: "Network", hotkey: "4", color: "#a855f7" },
  { id: "maintenance", label: "Maintenance", hotkey: "5", color: "#34d399" },
];

const COMPASS_LABELS: Record<IsoRotation, string> = {
  0: "SE",
  1: "NE",
  2: "NW",
  3: "SW",
};

export function InfoOverlayDock({
  overlayMode,
  rotation,
  zoom,
  cutaway,
  viewMode,
  onSelectOverlay,
  onRotateCCW,
  onRotateCW,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleCutaway,
}: InfoOverlayDockProps) {
  return (
    <aside className={styles.dock} aria-label="Cities: Skylines Info Views & Camera Controls">
      <div className={styles.card}>
        <div className={styles.sectionTitle}>INFO VIEWS</div>
        <div className={styles.overlayList} role="radiogroup" aria-label="3D Info Overlays">
          {OVERLAY_OPTIONS.map((opt) => {
            const active = overlayMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={[styles.overlayBtn, active ? styles.overlayBtnActive : ""].filter(Boolean).join(" ")}
                onClick={() => onSelectOverlay(opt.id)}
              >
                <span className={styles.dot} style={{ backgroundColor: opt.color }} />
                <span className={styles.overlayLabel}>{opt.label}</span>
                <span className={styles.hotkey}>{opt.hotkey}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>
          CAMERA · {COMPASS_LABELS[rotation]} · {Math.round(zoom * 100)}%
        </div>
        <div className={styles.camGrid}>
          <button type="button" className={styles.camBtn} onClick={onRotateCCW} title="Rotate Counter-Clockwise (Q)">
            ⟲ Q
          </button>
          <button type="button" className={styles.camBtn} onClick={onRotateCW} title="Rotate Clockwise (E)">
            E ⟳
          </button>
          <button type="button" className={styles.camBtn} onClick={onZoomIn} title="Zoom In (+)">
            + In
          </button>
          <button type="button" className={styles.camBtn} onClick={onZoomOut} title="Zoom Out (-)">
            − Out
          </button>
          <button type="button" className={styles.camBtnWide} onClick={onFitView} title="Fit 3D Grid in View">
            ⊡ Reset Camera
          </button>
          {viewMode === "facility" && (
            <button
              type="button"
              aria-pressed={cutaway}
              className={[styles.camBtnWide, cutaway ? styles.cutawayActive : ""].filter(Boolean).join(" ")}
              onClick={onToggleCutaway}
              title="Toggle Cutaway Walls (C)"
            >
              {cutaway ? "Walls: Cutaway (C)" : "Walls: Full (C)"}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
