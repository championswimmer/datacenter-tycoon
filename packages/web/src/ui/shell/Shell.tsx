import { useState, useCallback, useEffect } from "react";
import { useSelector, useTickDriver } from "../../store/storeContext.js";
import { selectAllDatacenters } from "../../store/selectors.js";
import { useRoute, navigateToDc } from "../../router/hashRouter.js";
import type { Speed } from "../../store/tickDriver.js";
import { hasSeenTutorial } from "../../store/tutorialPersist.js";
import { TopBar } from "../topbar/TopBar.js";
import { DatacenterList } from "../left-rail/DatacenterList.js";
import { DatacenterView } from "../dc-view/DatacenterView.js";
import { EmptyState } from "../dc-view/EmptyState.js";
import { LogFeed } from "../log/LogFeed.js";
import { NewDatacenterModal } from "../onboarding/NewDatacenterModal.js";
import { ContractsPage } from "../contracts/ContractsPage.js";
import { TutorialModal } from "../help/TutorialModal.js";
import styles from "./Shell.module.css";

interface ShellProps {
  isFreshStart?: boolean;
}

export function Shell({ isFreshStart = false }: ShellProps) {
  const [speed, setSpeed]               = useState<Speed>(1);
  const [showNewDcModal, setShowNewDcModal] = useState(false);
  const [showTutorial, setShowTutorial]   = useState(false);

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

  const openNewDcModal  = useCallback(() => setShowNewDcModal(true),  []);
  const closeNewDcModal = useCallback(() => setShowNewDcModal(false), []);
  const openTutorial    = useCallback(() => setShowTutorial(true),   []);
  const closeTutorial   = useCallback(() => setShowTutorial(false),  []);

  return (
    <div className={styles.shell}>
      <TopBar speed={speed} onSpeedChange={setSpeed} onOpenTutorial={openTutorial} />

      <div className={styles.body}>
        {/* ── Left rail ── */}
        <nav className={styles.leftRail} aria-label="Datacenter navigation">
          <DatacenterList
            currentRoute={route}
            onNewDatacenter={openNewDcModal}
          />
        </nav>

        {/* ── Main viewport ── */}
        <main className={styles.viewport}>
          <MainContent
            route={route}
            datacenters={datacenters}
            onNewDatacenter={openNewDcModal}
          />
        </main>

        {/* ── Right rail ── */}
        <aside className={styles.rightRail} aria-label="Event log">
          <LogFeed />
        </aside>
      </div>

      {/* ── Modals (rendered above the grid so they overlay everything) ── */}
      {showNewDcModal && (
        <NewDatacenterModal onClose={closeNewDcModal} />
      )}
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
