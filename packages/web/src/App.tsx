import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { SaveInfo } from "./store/persist.js";
import {
  bootstrapStore,
  createFreshSession,
  createLoadedSession,
  getLatestSaveInfo,
  type StoreSession,
} from "./store/persist.js";
import { StoreProvider } from "./store/storeContext.js";
import { Shell } from "./ui/shell/Shell.js";
import styles from "./App.module.css";

const ThemePlayground = lazy(
  () => import("./ui/theme-playground/index.js"),
);

type StartChoice = "load" | "new";

function createAppSession(choice: StartChoice | "auto"): StoreSession {
  switch (choice) {
    case "load":
      return createLoadedSession() ?? createFreshSession();
    case "new":
      return createFreshSession();
    default:
      return bootstrapStore();
  }
}

interface AppSessionController {
  session: StoreSession;
  hasSavedGame: boolean;
  latestSave: SaveInfo | null;
  startNewGame: () => void;
  loadLatestGame: () => void;
}

function useAppSession(): AppSessionController {
  const [session, setSession] = useState<StoreSession>(() => createAppSession("auto"));
  const [latestSave, setLatestSave] = useState<SaveInfo | null>(() => getLatestSaveInfo());
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    return () => {
      sessionRef.current.stopAutosave();
    };
  }, []);

  const replaceSession = useCallback((choice: StartChoice) => {
    const nextSession = createAppSession(choice);
    sessionRef.current = nextSession;
    setSession((previousSession) => {
      previousSession.stopAutosave();
      return nextSession;
    });
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
  const { session } = useAppSession();

  // Dev-only route — bypass shell entirely
  if (import.meta.env.DEV && window.location.hash === "#/__theme") {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
        <ThemePlayground />
      </Suspense>
    );
  }

  return (
    <StoreProvider store={session.store}>
      <Shell isFreshStart={session.isFreshStart} />
    </StoreProvider>
  );
}
