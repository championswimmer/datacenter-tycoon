import { useState, useCallback, useEffect, useRef, type SetStateAction } from "react";
import { useSelector, useTickDriver, useGameDispatch } from "../../store/storeContext.js";
import { useAutopilotRunner } from "../../store/useAutopilotRunner.js";
import { selectAllDatacenters } from "../../store/selectors.js";
import { useRoute, navigate, navigateToDc, navigateToMap } from "../../router/hashRouter.js";
import type { Speed } from "../../store/tickDriver.js";
import { hasSeenTutorial } from "../../store/tutorialPersist.js";
import { useIsPhoneViewport } from "../responsive.js";
import { TopBar } from "../topbar/TopBar.js";
import { DatacenterList } from "../left-rail/DatacenterList.js";
import { DatacenterView } from "../dc-view/DatacenterView.js";
import { EmptyState } from "../dc-view/EmptyState.js";
import { LogFeed } from "../log/LogFeed.js";
import { ContractsPage } from "../contracts/ContractsPage.js";
import { StrategyPage } from "../strategy/StrategyPage.js";
import { TutorialModal } from "../help/TutorialModal.js";
import { MapView } from "../map/MapView.js";
import styles from "./Shell.module.css";

interface ShellProps {
  shouldAutoOpenTutorial?: boolean;
}

type MobileDrawer = "none" | "datacenters" | "log";

export function Shell({ shouldAutoOpenTutorial = false }: ShellProps) {
  const dispatch = useGameDispatch();
  const speed = useSelector(s => s.game.speed as Speed);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeMobileDrawer, setActiveMobileDrawer] = useState<MobileDrawer>("none");
  const isPhoneViewport = useIsPhoneViewport();
  const datacenterTriggerRef = useRef<HTMLButtonElement>(null);
  const logTriggerRef = useRef<HTMLButtonElement>(null);
  const previousRouteKeyRef = useRef<string | null>(null);

  const setSpeed = useCallback((value: SetStateAction<Speed>) => {
    const newSpeed = typeof value === "function" ? value(speed) : value;
    dispatch({ type: "SetSpeed", speed: newSpeed });
  }, [dispatch, speed]);

  const getSpeed = useCallback(() => speed, [speed]);
  useTickDriver(getSpeed);
  // Drive contract autopilot — pure no-op when the preference is off, but
  // mounted here so it keeps acting regardless of which page is visible.
  useAutopilotRunner();

  const route       = useRoute();
  const datacenters = useSelector(selectAllDatacenters);
  const routeKey = route.view === "dc" ? `${route.view}:${route.dcId}:${route.tab}` : route.view;

  // Keep the current route valid as sessions change.
  useEffect(() => {
    if (route.view === "home") {
      if (datacenters.length > 0) {
        navigateToDc(datacenters[0]!.id);
      }
      return;
    }

    if (route.view === "dc") {
      if (datacenters.length === 0) {
        navigate({ view: "home" });
        return;
      }

      const hasActiveDatacenter = datacenters.some((dc) => dc.id === route.dcId);
      if (!hasActiveDatacenter) {
        navigateToDc(datacenters[0]!.id, route.tab);
      }
    }
  }, [route, datacenters]);

  // Auto-open tutorial only after the player has started a fresh session.
  useEffect(() => {
    if (shouldAutoOpenTutorial && !hasSeenTutorial()) {
      setShowTutorial(true);
    }
  }, [shouldAutoOpenTutorial]);

  const focusDrawerTrigger = useCallback((drawer: MobileDrawer) => {
    if (drawer === "datacenters") {
      datacenterTriggerRef.current?.focus();
    }
    if (drawer === "log") {
      logTriggerRef.current?.focus();
    }
  }, []);

  const closeMobileDrawer = useCallback((drawer: MobileDrawer) => {
    setActiveMobileDrawer("none");
    window.requestAnimationFrame(() => focusDrawerTrigger(drawer));
  }, [focusDrawerTrigger]);

  useEffect(() => {
    if (previousRouteKeyRef.current !== null && previousRouteKeyRef.current !== routeKey && activeMobileDrawer !== "none") {
      closeMobileDrawer(activeMobileDrawer);
    }
    previousRouteKeyRef.current = routeKey;
  }, [routeKey, activeMobileDrawer, closeMobileDrawer]);

  useEffect(() => {
    if (activeMobileDrawer === "none") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileDrawer(activeMobileDrawer);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMobileDrawer, closeMobileDrawer]);

  const toggleMobileDrawer = useCallback((drawer: Exclude<MobileDrawer, "none">) => {
    setActiveMobileDrawer(current => {
      if (current === drawer) {
        window.requestAnimationFrame(() => focusDrawerTrigger(drawer));
        return "none";
      }
      return drawer;
    });
  }, [focusDrawerTrigger]);
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
              onOpenRegions={openMap}
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
            data-mobile-drawer={isPhoneViewport ? "log" : undefined}
          >
            <LogFeed />
          </aside>
        )}
      </div>

      {isPhoneViewport && (
        <>
          <button
            ref={datacenterTriggerRef}
            type="button"
            className={[styles.drawerTrigger, styles.drawerTriggerLeft].join(" ")}
            onClick={() => toggleMobileDrawer("datacenters")}
            aria-label="Toggle datacenters drawer"
            aria-controls="shell-datacenter-drawer"
            aria-expanded={isDatacenterDrawerOpen}
          >
            <span className={styles.drawerTriggerLabel}>DCS</span>
          </button>

          <button
            ref={logTriggerRef}
            type="button"
            className={[styles.drawerTrigger, styles.drawerTriggerRight].join(" ")}
          onClick={() => toggleMobileDrawer("log")}
            aria-label="Toggle event log drawer"
            aria-controls="shell-log-drawer"
            aria-expanded={isLogDrawerOpen}
          >
            <span className={styles.drawerTriggerLabel}>LOG</span>
          </button>
        </>
      )}

      {isPhoneViewport && activeMobileDrawer !== "none" && (
        <button
          type="button"
          className={styles.drawerBackdrop}
          onClick={() => closeMobileDrawer(activeMobileDrawer)}
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

    case "strategy":
      return <StrategyPage />;

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
