import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Difficulty } from "@datacenter-tycoon/game-logic";
import {
  buildLeaderboardRunSubmission,
  LeaderboardSubmissionError,
  submitLeaderboardRun,
} from "./online/leaderboard.js";
import {
  isRegistrationUnavailableError,
  PlayerRegistrationError,
  registerPlayer,
} from "./online/players.js";
import type { SaveInfo } from "./store/persist.js";
import {
  createFreshSession,
  createLoadedSession,
  getLatestSaveInfo,
  type StoreSession,
} from "./store/persist.js";
import {
  getStoredPlayerIdentity,
  writeStoredPlayerIdentity,
  type StoredPlayerIdentity,
} from "./store/playerIdentity.js";
import { StoreProvider } from "./store/storeContext.js";
import { Shell } from "./ui/shell/Shell.js";
import { StartScreen } from "./ui/start/StartScreen.js";
import styles from "./App.module.css";

const ThemePlayground = lazy(
  () => import("./ui/theme-playground/index.js"),
);

type StartChoice = "load" | "new";

const OFFLINE_LEADERBOARD_NOTICE = "Online leaderboard registration is unavailable right now. New runs from this device will stay local until the backend is reachable again.";
const LEADERBOARD_SYNC_UNAVAILABLE_NOTICE = "Online leaderboard sync is unavailable right now. This run will keep progressing locally until the backend is reachable again.";

function createAppSession(
  choice: StartChoice,
  difficulty: Difficulty,
  latestSaveGameId: string | null,
  playerName?: string,
): StoreSession {
  if (choice === "load") {
    return createLoadedSession(latestSaveGameId ?? undefined)
      ?? createFreshSession({ difficulty, playerName });
  }

  return createFreshSession({ difficulty, playerName });
}

interface AppSessionController {
  session: StoreSession | null;
  hasSavedGame: boolean;
  latestSave: SaveInfo | null;
  playerIdentity: StoredPlayerIdentity | null;
  usernameDraft: string;
  statusMessage: string | null;
  startError: string | null;
  isStarting: boolean;
  selectedDifficulty: Difficulty;
  selectDifficulty: (difficulty: Difficulty) => void;
  setUsernameDraft: (username: string) => void;
  startNewGame: () => Promise<void>;
  loadLatestGame: () => void;
}

function useAppSession(): AppSessionController {
  const [session, setSession] = useState<StoreSession | null>(null);
  const [latestSave, setLatestSave] = useState<SaveInfo | null>(() => getLatestSaveInfo());
  const [playerIdentity, setPlayerIdentity] = useState<StoredPlayerIdentity | null>(
    () => getStoredPlayerIdentity(),
  );
  const [usernameDraft, setUsernameDraft] = useState<string>(
    () => getStoredPlayerIdentity()?.username ?? getLatestSaveInfo()?.playerName ?? "",
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("hard");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const sessionRef = useRef<StoreSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    return () => {
      sessionRef.current?.stopAutosave();
    };
  }, []);

  const replaceSession = useCallback((choice: StartChoice, playerName?: string) => {
    const nextSession = createAppSession(
      choice,
      selectedDifficulty,
      latestSave?.gameId ?? null,
      playerName,
    );
    sessionRef.current?.stopAutosave();
    sessionRef.current = nextSession;
    setSession(nextSession);
    setLatestSave((currentLatestSave) => currentLatestSave);
  }, [latestSave?.gameId, selectedDifficulty]);

  const startNewGame = useCallback(async () => {
    setStartError(null);

    if (playerIdentity) {
      setStatusMessage(null);
      replaceSession("new", playerIdentity.username);
      return;
    }

    const requestedUsername = usernameDraft.trim().replace(/\s+/g, " ");

    if (!requestedUsername) {
      setStartError("Enter a username before starting your first run.");
      return;
    }

    setIsStarting(true);

    try {
      const identity = await registerPlayer(requestedUsername);
      writeStoredPlayerIdentity(identity);
      setPlayerIdentity(identity);
      setUsernameDraft(identity.username);
      setStatusMessage(null);
      replaceSession("new", identity.username);
    } catch (error) {
      if (isRegistrationUnavailableError(error)) {
        setStatusMessage(OFFLINE_LEADERBOARD_NOTICE);
        replaceSession("new", requestedUsername);
        return;
      }

      if (error instanceof PlayerRegistrationError) {
        setStartError(error.message);
        return;
      }

      setStatusMessage(OFFLINE_LEADERBOARD_NOTICE);
      replaceSession("new", requestedUsername);
    } finally {
      setIsStarting(false);
    }
  }, [playerIdentity, replaceSession, usernameDraft]);

  useEffect(() => {
    if (!session || !playerIdentity) {
      return undefined;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastSubmittedSignature: string | null = null;

    const submitSnapshot = async () => {
      const state = session.store.getState();

      if (state.tick < 1) {
        return;
      }

      const submission = buildLeaderboardRunSubmission(playerIdentity.playerId, state);
      const signature = JSON.stringify(submission);

      if (signature === lastSubmittedSignature) {
        return;
      }

      try {
        await submitLeaderboardRun(submission);
        lastSubmittedSignature = signature;
        if (!cancelled) {
          setStatusMessage((current) =>
            current === LEADERBOARD_SYNC_UNAVAILABLE_NOTICE ? null : current);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof LeaderboardSubmissionError) {
          if (error.code === "ONLINE_LEADERBOARD_DISABLED") {
            return;
          }

          console.warn("[leaderboard] Failed to sync run summary:", error.message);

          // Permanent 4xx errors (except 429 rate-limiting) are not transient:
          // mark this snapshot as already-attempted so we don't re-submit on
          // every store tick and mislead the user about backend availability.
          const isPermanentClientError = error.status !== null
            && error.status >= 400
            && error.status < 500
            && error.status !== 429;

          if (isPermanentClientError) {
            lastSubmittedSignature = signature;
            return;
          }
        }

        setStatusMessage((current) => current ?? LEADERBOARD_SYNC_UNAVAILABLE_NOTICE);
      }
    };

    const scheduleSubmission = () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        void submitSnapshot();
      }, 750);
    };

    scheduleSubmission();
    const unsubscribe = session.store.subscribe(scheduleSubmission);

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      unsubscribe();
    };
  }, [playerIdentity, session]);

  return {
    session,
    hasSavedGame: latestSave !== null,
    latestSave,
    playerIdentity,
    usernameDraft,
    statusMessage,
    startError,
    isStarting,
    selectedDifficulty,
    selectDifficulty: setSelectedDifficulty,
    setUsernameDraft,
    startNewGame,
    loadLatestGame: () => replaceSession("load", playerIdentity?.username ?? usernameDraft.trim()),
  };
}

export default function App() {
  const {
    session,
    hasSavedGame,
    latestSave,
    playerIdentity,
    usernameDraft,
    statusMessage,
    startError,
    isStarting,
    selectedDifficulty,
    selectDifficulty,
    setUsernameDraft,
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
        playerIdentity={playerIdentity}
        usernameDraft={usernameDraft}
        statusMessage={statusMessage}
        startError={startError}
        isStarting={isStarting}
        selectedDifficulty={selectedDifficulty}
        onSelectDifficulty={selectDifficulty}
        onUsernameDraftChange={setUsernameDraft}
        onPlay={startNewGame}
        onLoadGame={loadLatestGame}
        onNewGame={startNewGame}
      />
    );
  }

  return (
    <>
      {statusMessage && (
        <div className={styles.statusBanner} role="status">
          {statusMessage}
        </div>
      )}
      <StoreProvider store={session.store}>
        <Shell shouldAutoOpenTutorial={session.isFreshStart} />
      </StoreProvider>
    </>
  );
}
