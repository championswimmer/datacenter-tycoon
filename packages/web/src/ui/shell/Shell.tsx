import { useState, useCallback, useEffect, type SetStateAction } from "react";
import { useSelector, useTickDriver, useGameDispatch } from "../../store/storeContext.js";
import { selectAllDatacenters } from "../../store/selectors.js";
import { useRoute, navigateToDc, navigateToMap } from "../../router/hashRouter.js";
import type { Speed } from "../../store/tickDriver.js";
import { hasSeenTutorial } from "../../store/tutorialPersist.js";
import { useIsPhoneViewport } from "../responsive.js";
import { TopBar } from "../topbar/TopBar.js";
import { DatacenterList } from "../left-rail/DatacenterList.js";
import { DatacenterView } from "../dc-view/DatacenterView.js";
import { EmptyState } from "../dc-view/EmptyState.js";
import { LogFeed } from "../log/LogFeed.js";
import { ContractsPage } from "../contracts/ContractsPage.js";
import { TutorialModal } from "../help/TutorialModal.js";
import { MapView } from "../map/MapView.js";
import styles from "./Shell.module.css";

interface ShellProps {
  isFreshStart?: boolean;
}

type MobileDrawer = "none" | "datacenters" | "log";

export function Shell({ isFreshStart = false }: ShellProps) {
  const dispatch = useGameDispatch();
  const speed = useSelector(s => s.game.speed as Speed);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeMobileDrawer, setActiveMobileDrawer] = useState<MobileDrawer>("none");
  const isPhoneViewport = useIsPhoneViewport();

  const setSpeed = useCallback((value: SetStateAction<Speed>) => {
    const newSpeed = typeof value === "function" ? value(speed) : value;
    dispatch({ type: "SetSpeed", speed: newSpeed });
  }, [dispatch, speed]);

  const getSpeed = useCallback(() => speed, [speed]);
  useTickDriver(getSpeed);

  const route       = useRoute();
  const datacenters = useSelector(selectAllDatacenters);

  // Auto-redirect "/" → first DC when one exists
  useEffect(() => {
    if (route.view === "home" && datacenters.length > 0) {
      navigateToDc(datacenters[0]!.id);
    }
  }, [route.view, datacenters]);

  // Auto-open tutorial on first fresh game launch
  useEffect(() => {
    if (isFreshStart && !hasSeenTutorial()) {
      setShowTutorial(true);
    }
  }, [isFreshStart]);

  useEffect(() => {
    setActiveMobileDrawer("none");
  }, [route]);

  useEffect(() => {
    if (activeMobileDrawer === "none") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMobileDrawer("none");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMobileDrawer]);

  const closeMobileDrawer = useCallback(() => setActiveMobileDrawer("none"), []);
  const isDatacenterDrawerOpen = activeMobileDrawer === "datacenters";
  const isLogDrawerOpen = activeMobileDrawer === "log";

  const openTutorial    = useCallback(() => setShowTutorial(true),   []);
  const closeTutorial   = useCallback(() => setShowTutorial(false),  []);
  const openMap         = useCallback(() => navigateToMap(),         []);

  return (
    <div className={styles.shell}>
      <TopBar speed={speed} onSpeedChange={setSpeed} onOpenTutorial={openTutorial} />

      <div className={[styles.body, isPhoneViewport ? styles.bodyPhone : ""].join(" ")}>
        {/* ── Left rail ── */}
        {(!isPhoneViewport || isDatacenterDrawerOpen) && (
          <nav
            id="shell-datacenter-drawer"
            className={[
              styles.leftRail,
              isPhoneViewport ? styles.mobileDrawer : "",
              isPhoneViewport ? styles.mobileDrawerLeft : "",
              isDatacenterDrawerOpen ? styles.mobileDrawerOpen : "",
            ].join(" ")}
            aria-label="Datacenter navigation"
            data-mobile-drawer={isPhoneViewport ? "datacenters" : undefined}
          >
            <DatacenterList
              currentRoute={route}
              onNewDatacenter={openMap}
            />
          </nav>
        )}

        {/* ── Main viewport ── */}
        <main className={styles.viewport}>
          <MainContent
            key={route.view === "dc" ? `dc-${route.dcId}` : route.view}
            route={route}
            datacenters={datacenters}
            onNewDatacenter={openMap}
          />
        </main>

        {/* ── Right rail ── */}
        {(!isPhoneViewport || isLogDrawerOpen) && (
          <aside
            id="shell-log-drawer"
            className={[
              styles.rightRail,
              isPhoneViewport ? styles.mobileDrawer : "",
              isPhoneViewport ? styles.mobileDrawerRight : "",
              isLogDrawerOpen ? styles.mobileDrawerOpen : "",
            ].join(" ")}
            aria-label="Event log"
          >
            <LogFeed />
          </aside>
        )}
      </div>

      {isPhoneViewport && activeMobileDrawer !== "none" && (
        <button
          type="button"
          className={styles.drawerBackdrop}
          onClick={closeMobileDrawer}
          aria-label="Close mobile drawer"
        />
      )}

      {/* ── Modals (rendered above the grid so they overlay everything) ── */}
      {showTutorial && (
        <TutorialModal onClose={closeTutorial} />
      )}
    </div>
  );
}

// ── Route dispatch ─────────────────────────────────────────────────────────────

interface MainContentProps {
  route:          ReturnType<typeof useRoute>;
  datacenters:    ReturnType<typeof selectAllDatacenters>;
  onNewDatacenter: () => void;
}

function MainContent({ route, datacenters, onNewDatacenter }: MainContentProps) {
  switch (route.view) {
    case "dc":
      return <DatacenterView dcId={route.dcId} tab={route.tab} />;

    case "contracts":
      return <ContractsPage />;

    case "map":
      return <MapView />;

    case "log":
      return <GlobalPlaceholder icon="📜" title="Full Event Log" phase="Phase 9" />;

    case "home":
    default:
      if (datacenters.length > 0) {
        // Still redirecting — render nothing to avoid flash
        return null;
      }
      return <EmptyState onNewDatacenter={onNewDatacenter} />;
  }
}

function GlobalPlaceholder({ icon, title, phase }: { icon: string; title: string; phase: string }) {
  return (
    <div className={styles.globalPlaceholder}>
      <span className={styles.gpIcon}>{icon}</span>
      <p className={styles.gpTitle}>{title}</p>
      <p className={styles.gpPhase}>Implemented in {phase}</p>
    </div>
  );
}
