import { useState } from "react";
import { StartScreen, StoreProvider, useAppSession } from "@datacenter-tycoon/web";
import { IsoShell } from "./ui/shell/IsoShell.js";
import styles from "./App.module.css";

export function App() {
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

  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);

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
      {statusMessage && statusMessage !== dismissedNotice && (
        <div className={styles.statusBanner} role="status">
          <span>{statusMessage}</span>
          <button
            type="button"
            className={styles.statusDismiss}
            aria-label="Dismiss notice"
            onClick={() => setDismissedNotice(statusMessage)}
          >
            ✕
          </button>
        </div>
      )}
      <StoreProvider store={session.store}>
        <IsoShell shouldAutoOpenTutorial={session.isFreshStart} />
      </StoreProvider>
    </>
  );
}

export default App;
