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
        <IsoShell shouldAutoOpenTutorial={session.isFreshStart} />
      </StoreProvider>
    </>
  );
}

export default App;
