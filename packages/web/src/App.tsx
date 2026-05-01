import { lazy, Suspense, useState, useCallback } from "react";
import { bootstrapStore } from "./store/persist.js";
import { StoreProvider, useSelector, useTickDriver } from "./store/storeContext.js";
import { selectCash, selectTick } from "./store/selectors.js";
import { VERSION } from "@datacenter-tycoon/game-logic";
import type { Speed } from "./store/tickDriver.js";
import styles from "./App.module.css";

const ThemePlayground = lazy(
  () => import("./ui/theme-playground/index.js"),
);

// Bootstrap once — outside the component to survive HMR re-renders.
const { store, stopAutosave: _stopAutosave } = bootstrapStore();

// ── Root with store wired ──────────────────────────────────────────────────────

export default function App() {
  const hash = window.location.hash;

  if (import.meta.env.DEV && hash === "#/__theme") {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
        <ThemePlayground />
      </Suspense>
    );
  }

  return (
    <StoreProvider store={store}>
      <AppShell />
    </StoreProvider>
  );
}

// ── Inner shell (has access to store context) ──────────────────────────────────

function AppShell() {
  const [speed, setSpeed] = useState<Speed>(1);
  const getSpeed = useCallback(() => speed, [speed]);
  useTickDriver(getSpeed);

  const cash = useSelector(selectCash);
  const tick = useSelector(selectTick);

  return (
    <div className={styles.shell}>
      <header className={styles.bootHeader}>
        <span className={styles.logo}>DATACENTER TYCOON</span>
        <span className={styles.version}>game-logic v{VERSION}</span>
        <span className={styles.hud}>
          tick: <strong>{tick}</strong>
        </span>
        <span className={styles.hud}>
          cash: <strong>${cash.toLocaleString()}</strong>
        </span>
        <span className={styles.speedControls}>
          {([0, 1, 2, 3] as Speed[]).map((s) => (
            <button
              key={s}
              className={[styles.speedBtn, speed === s ? styles.speedActive : ""].join(" ")}
              onClick={() => setSpeed(s)}
              title={`Speed ${s}`}
            >
              {s === 0 ? "⏸" : "▶".repeat(s)}
            </button>
          ))}
        </span>
      </header>
      <main className={styles.main}>
        <p className={styles.hint}>
          Phase 4 (app shell &amp; routing) coming next.
        </p>
      </main>
    </div>
  );
}
