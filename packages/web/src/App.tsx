import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Difficulty } from "@datacenter-tycoon/game-logic";
import {
  DEFAULT_START_SCREEN_LEADERBOARD_LIMIT,
  DEFAULT_START_SCREEN_LEADERBOARD_METRIC,
  DEFAULT_START_SCREEN_LEADERBOARD_PERIOD,
  DEFAULT_START_SCREEN_LEADERBOARD_VISIBILITY,
  fetchLeaderboard,
  type LeaderboardListResult,
  type LeaderboardQueryMetric,
  type LeaderboardVisibility,
  LeaderboardQueryError,
  LeaderboardSubmissionError,
  submitLeaderboardRun,
} from "./online/leaderboard.js";
import {
  acknowledgeVerifiedCheckpoint,
  buildVerifiedCheckpointSubmission,
  getLastEligibleGameMonth,
  getPendingTickDelta,
  getRemainingTickAllowance,
  markVerifiedRunSyncFailure,
} from "./online/verified-run.js";
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
  writeSaveData,
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
const DISABLED_LEADERBOARD_NOTICE = "Online leaderboard registration is disabled for this build. New runs from this device will stay local.";
const LEADERBOARD_SYNC_UNAVAILABLE_NOTICE = "Online leaderboard verification is unavailable right now.";
const LOCAL_ONLY_RUN_NOTICE = "This run is local-only and will not appear on the verified leaderboard.";
const LEADERBOARD_QUERY_FAILED_MESSAGE = "Could not load the online leaderboard right now.";
const TRANSIENT_STATUS_MESSAGE_DURATION_MS = 3_000;
/** Submit a verified checkpoint at least this often in game months. */
const CHECKPOINT_SUBMIT_EVERY_TICKS = 5;
/** …and at least this often in wall-clock time, so paused/slow runs still sync. */
const CHECKPOINT_SUBMIT_INTERVAL_MS = 15_000;

function createAppSession(
  choice: StartChoice,
  difficulty: Difficulty,
  latestSaveGameId: string | null,
  options: { playerName?: string; onlineEligible?: boolean } = {},
): StoreSession {
  if (choice === "load") {
    return createLoadedSession(latestSaveGameId ?? undefined, {
      onlineEligible: options.onlineEligible,
    }) ?? createFreshSession({
      difficulty,
      playerName: options.playerName,
      onlineEligible: options.onlineEligible,
    });
  }

  return createFreshSession({
    difficulty,
    playerName: options.playerName,
    onlineEligible: options.onlineEligible,
  });
}

type LeaderboardCacheKey = `${LeaderboardQueryMetric}:${LeaderboardVisibility}`;
type LeaderboardResultCache = Partial<Record<LeaderboardCacheKey, LeaderboardListResult>>;
type LeaderboardErrorCache = Partial<Record<LeaderboardCacheKey, string>>;
type LeaderboardLoadingCache = Partial<Record<LeaderboardCacheKey, boolean>>;

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
  isLeaderboardOpen: boolean;
  activeLeaderboardMetric: LeaderboardQueryMetric;
  activeLeaderboardVisibility: LeaderboardVisibility;
  isLeaderboardLoading: boolean;
  leaderboardResult: LeaderboardListResult | null;
  leaderboardError: string | null;
  selectDifficulty: (difficulty: Difficulty) => void;
  setUsernameDraft: (username: string) => void;
  startNewGame: () => Promise<void>;
  loadLatestGame: () => void;
  openLeaderboard: () => void;
  closeLeaderboard: () => void;
  selectLeaderboardMetric: (metric: LeaderboardQueryMetric) => void;
  selectLeaderboardVisibility: (visibility: LeaderboardVisibility) => void;
  retryLeaderboard: () => void;
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
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [activeLeaderboardMetric, setActiveLeaderboardMetric] = useState<LeaderboardQueryMetric>(
    DEFAULT_START_SCREEN_LEADERBOARD_METRIC,
  );
  const [activeLeaderboardVisibility, setActiveLeaderboardVisibility] = useState<LeaderboardVisibility>(
    DEFAULT_START_SCREEN_LEADERBOARD_VISIBILITY,
  );
  const [leaderboardResultsByMetric, setLeaderboardResultsByMetric] = useState<LeaderboardResultCache>({});
  const [leaderboardErrorsByMetric, setLeaderboardErrorsByMetric] = useState<LeaderboardErrorCache>({});
  const [leaderboardLoadingByMetric, setLeaderboardLoadingByMetric] = useState<LeaderboardLoadingCache>({});
  const sessionRef = useRef<StoreSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    return () => {
      sessionRef.current?.stopAutosave();
    };
  }, []);

  const replaceSession = useCallback((choice: StartChoice, playerName?: string, onlineEligible = Boolean(playerIdentity)) => {
    const nextSession = createAppSession(
      choice,
      selectedDifficulty,
      latestSave?.gameId ?? null,
      {
        playerName,
        onlineEligible,
      },
    );
    sessionRef.current?.stopAutosave();
    sessionRef.current = nextSession;
    setSession(nextSession);
    setLatestSave((currentLatestSave) => currentLatestSave);
  }, [latestSave?.gameId, playerIdentity, selectedDifficulty]);

  const startNewGame = useCallback(async () => {
    setStartError(null);

    if (playerIdentity) {
      setStatusMessage(null);
      replaceSession("new", playerIdentity.username, true);
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
      replaceSession("new", identity.username, true);
    } catch (error) {
      if (error instanceof PlayerRegistrationError && error.code === "ONLINE_LEADERBOARD_DISABLED") {
        setStatusMessage(DISABLED_LEADERBOARD_NOTICE);
        replaceSession("new", requestedUsername, false);
        return;
      }

      if (isRegistrationUnavailableError(error)) {
        setStatusMessage(OFFLINE_LEADERBOARD_NOTICE);
        replaceSession("new", requestedUsername, false);
        return;
      }

      if (error instanceof PlayerRegistrationError) {
        setStartError(error.message);
        return;
      }

      setStatusMessage(OFFLINE_LEADERBOARD_NOTICE);
      replaceSession("new", requestedUsername, false);
    } finally {
      setIsStarting(false);
    }
  }, [playerIdentity, replaceSession, usernameDraft]);

  useEffect(() => {
    if (
      statusMessage !== OFFLINE_LEADERBOARD_NOTICE
      && statusMessage !== DISABLED_LEADERBOARD_NOTICE
    ) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setStatusMessage((current) =>
        current === OFFLINE_LEADERBOARD_NOTICE || current === DISABLED_LEADERBOARD_NOTICE
          ? null
          : current
      );
    }, TRANSIENT_STATUS_MESSAGE_DURATION_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [statusMessage]);

  const loadLeaderboard = useCallback(async (
    metric: LeaderboardQueryMetric,
    visibility: LeaderboardVisibility,
    options: { force?: boolean } = {},
  ) => {
    const cacheKey = `${metric}:${visibility}` satisfies LeaderboardCacheKey;

    if (leaderboardLoadingByMetric[cacheKey]) {
      return;
    }

    if (!options.force && leaderboardResultsByMetric[cacheKey]) {
      return;
    }

    setLeaderboardLoadingByMetric((current) => ({
      ...current,
      [cacheKey]: true,
    }));
    setLeaderboardErrorsByMetric((current) => {
      const next = { ...current };
      delete next[cacheKey];
      return next;
    });

    try {
      const result = await fetchLeaderboard({
        metric,
        period: DEFAULT_START_SCREEN_LEADERBOARD_PERIOD,
        limit: DEFAULT_START_SCREEN_LEADERBOARD_LIMIT,
        visibility,
      });
      setLeaderboardResultsByMetric((current) => ({
        ...current,
        [cacheKey]: result,
      }));
    } catch (error) {
      const message = error instanceof LeaderboardQueryError || error instanceof Error
        ? error.message
        : LEADERBOARD_QUERY_FAILED_MESSAGE;

      setLeaderboardErrorsByMetric((current) => ({
        ...current,
        [cacheKey]: message,
      }));
    } finally {
      setLeaderboardLoadingByMetric((current) => {
        const next = { ...current };
        delete next[cacheKey];
        return next;
      });
    }
  }, [leaderboardLoadingByMetric, leaderboardResultsByMetric]);

  const activeLeaderboardCacheKey = `${activeLeaderboardMetric}:${activeLeaderboardVisibility}` satisfies LeaderboardCacheKey;
  const leaderboardResult = leaderboardResultsByMetric[activeLeaderboardCacheKey] ?? null;
  const leaderboardError = leaderboardErrorsByMetric[activeLeaderboardCacheKey] ?? null;
  const isLeaderboardLoading = Boolean(leaderboardLoadingByMetric[activeLeaderboardCacheKey]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    if (!playerIdentity) {
      if (session.verification.getState().status !== "local-only") {
        session.verification.update((current) => ({ ...current, status: "local-only" }));
      }
      return undefined;
    }

    let cancelled = false;
    let inFlight = false;
    // Cadence anchors: a checkpoint is due once either the tick budget or the
    // wall-clock budget since the last attempt is exhausted.
    let lastAttemptTick = session.store.getState().tick;
    let lastAttemptAt = Date.now();

    const submitCheckpoint = async () => {
      if (inFlight) {
        return;
      }

      const state = session.store.getState();
      const verification = session.verification.getState();
      const submission = buildVerifiedCheckpointSubmission(playerIdentity.playerId, verification);

      // Reopen the cadence window even when there is nothing to send, so an idle
      // run does not re-evaluate on every subtick.
      lastAttemptTick = state.tick;
      lastAttemptAt = Date.now();

      if (!submission) {
        return;
      }

      inFlight = true;

      try {
        const response = await submitLeaderboardRun(submission);
        const nextVerification = acknowledgeVerifiedCheckpoint(verification, response);
        session.verification.setState(nextVerification);
        writeSaveData({ state, verification: nextVerification });
        setStatusMessage((current) =>
          current === LEADERBOARD_SYNC_UNAVAILABLE_NOTICE || current === LOCAL_ONLY_RUN_NOTICE
            ? null
            : current);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const nextVerification = markVerifiedRunSyncFailure(
          verification,
          error instanceof LeaderboardSubmissionError ? error.code : null,
          state,
        );
        session.verification.setState(nextVerification);
        writeSaveData({ state, verification: nextVerification });

        if (nextVerification.status === "local-only") {
          setStatusMessage(LOCAL_ONLY_RUN_NOTICE);
          return;
        }

        if (error instanceof LeaderboardSubmissionError && error.code === "ONLINE_LEADERBOARD_DISABLED") {
          setStatusMessage((current) =>
            current === LEADERBOARD_SYNC_UNAVAILABLE_NOTICE ? null : current
          );
          return;
        }

        const pendingTicks = getPendingTickDelta(nextVerification, state);
        const remainingTicks = getRemainingTickAllowance(nextVerification, state);
        const lastEligibleMonth = getLastEligibleGameMonth(nextVerification);
        console.warn("[leaderboard] Failed to sync verified checkpoint:", error instanceof Error ? error.message : error);
        setStatusMessage(
          `${LEADERBOARD_SYNC_UNAVAILABLE_NOTICE} Reconnect before month ${lastEligibleMonth} (${pendingTicks} of ${nextVerification.maxTickDelta} months pending, ${remainingTicks} remaining).`,
        );
      } finally {
        inFlight = false;
      }
    };

    // The store notifies on every daily subtick (30 per game month, as little as
    // ~83ms apart at 3× speed), so this must be a cadence gate rather than a
    // debounce — a debounce would be reset forever and never fire while playing.
    const submitIfDue = () => {
      const ticksSinceAttempt = session.store.getState().tick - lastAttemptTick;
      const msSinceAttempt = Date.now() - lastAttemptAt;

      if (
        ticksSinceAttempt >= CHECKPOINT_SUBMIT_EVERY_TICKS
        || msSinceAttempt >= CHECKPOINT_SUBMIT_INTERVAL_MS
      ) {
        void submitCheckpoint();
      }
    };

    // Establish the genesis checkpoint (or flush a restored save's backlog) now
    // rather than waiting out the first cadence window.
    void submitCheckpoint();
    const unsubscribe = session.store.subscribe(submitIfDue);
    // Keeps the wall-clock cadence honest while paused, when no subticks arrive.
    const interval = setInterval(submitIfDue, CHECKPOINT_SUBMIT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
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
    isLeaderboardOpen,
    activeLeaderboardMetric,
    activeLeaderboardVisibility,
    isLeaderboardLoading,
    leaderboardResult,
    leaderboardError,
    selectDifficulty: setSelectedDifficulty,
    setUsernameDraft,
    startNewGame,
    loadLatestGame: () => replaceSession("load", playerIdentity?.username ?? usernameDraft.trim()),
    openLeaderboard: () => {
      setIsLeaderboardOpen(true);
      void loadLeaderboard(activeLeaderboardMetric, activeLeaderboardVisibility);
    },
    closeLeaderboard: () => setIsLeaderboardOpen(false),
    selectLeaderboardMetric: (metric) => {
      setActiveLeaderboardMetric(metric);
      void loadLeaderboard(metric, activeLeaderboardVisibility);
    },
    selectLeaderboardVisibility: (visibility) => {
      setActiveLeaderboardVisibility(visibility);
      void loadLeaderboard(activeLeaderboardMetric, visibility);
    },
    retryLeaderboard: () => {
      void loadLeaderboard(activeLeaderboardMetric, activeLeaderboardVisibility, { force: true });
    },
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
    isLeaderboardOpen,
    activeLeaderboardMetric,
    activeLeaderboardVisibility,
    isLeaderboardLoading,
    leaderboardResult,
    leaderboardError,
    selectDifficulty,
    setUsernameDraft,
    startNewGame,
    loadLatestGame,
    openLeaderboard,
    closeLeaderboard,
    selectLeaderboardMetric,
    selectLeaderboardVisibility,
    retryLeaderboard,
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
        isLeaderboardOpen={isLeaderboardOpen}
        activeLeaderboardMetric={activeLeaderboardMetric}
        activeLeaderboardVisibility={activeLeaderboardVisibility}
        isLeaderboardLoading={isLeaderboardLoading}
        leaderboardResult={leaderboardResult}
        leaderboardError={leaderboardError}
        onSelectDifficulty={selectDifficulty}
        onUsernameDraftChange={setUsernameDraft}
        onPlay={startNewGame}
        onLoadGame={loadLatestGame}
        onNewGame={startNewGame}
        onOpenLeaderboard={openLeaderboard}
        onCloseLeaderboard={closeLeaderboard}
        onSelectLeaderboardMetric={selectLeaderboardMetric}
        onSelectLeaderboardVisibility={selectLeaderboardVisibility}
        onRetryLeaderboard={retryLeaderboard}
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
