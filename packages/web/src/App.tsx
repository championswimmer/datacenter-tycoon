import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { SaveInfo } from "./store/persist.js";
import {
  createFreshSession,
  createLoadedSession,
  getLatestSaveInfo,
  type StoreSession,
} from "./store/persist.js";
import { StoreProvider } from "./store/storeContext.js";
import { Shell } from "./ui/shell/Shell.js";
import { StartScreen } from "./ui/start/StartScreen.js";
import styles from "./App.module.css";

const ThemePlayground = lazy(
  () => import("./ui/theme-playground/index.js"),
);

type StartChoice = "load" | "new";

function createAppSession(choice: StartChoice): StoreSession {
  if (choice === "load") {
    return createLoadedSession() ?? createFreshSession();
  }

  return createFreshSession();
}

interface AppSessionController {
  session: StoreSession | null;
  hasSavedGame: boolean;
  latestSave: SaveInfo | null;
  startNewGame: () => void;
  loadLatestGame: () => void;
}

function useAppSession(): AppSessionController {
  const [session, setSession] = useState<StoreSession | null>(null);
  const [latestSave, setLatestSave] = useState<SaveInfo | null>(() => getLatestSaveInfo());
  const sessionRef = useRef<StoreSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    return () => {
      sessionRef.current?.stopAutosave();
    };
  }, []);

  const replaceSession = useCallback((choice: StartChoice) => {
    const nextSession = createAppSession(choice);
    sessionRef.current?.stopAutosave();
    sessionRef.current = nextSession;
    setSession(nextSession);
    setLatestSave(getLatestSaveInfo());
  }, []);

  return {
    session,
    hasSavedGame: latestSave !== null,
    latestSave,
    startNewGame: () => replaceSession("new"),
    loadLatestGame: () => replaceSession("load"),
  };
}

export default function App() {
  const {
    session,
    hasSavedGame,
    latestSave,
    startNewGame,
    loadLatestGame,
  } = useAppSession();

  // Dev-only route — bypass shell entirely
  if (import.meta.env.DEV && window.location.hash === "#/__theme") {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
        <ThemePlayground />
      </Suspense>
    );
  }

  if (!session) {
    return (
      <StartScreen
        hasSavedGame={hasSavedGame}
        latestSave={latestSave}
        onPlay={startNewGame}
        onLoadGame={loadLatestGame}
        onNewGame={startNewGame}
      />
    );
  }

  return (
    <StoreProvider store={session.store}>
      <Shell shouldAutoOpenTutorial={session.isFreshStart} />
    </StoreProvider>
  );
}
