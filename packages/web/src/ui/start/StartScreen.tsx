import type { Difficulty } from "@datacenter-tycoon/game-logic";
import type { StoredPlayerIdentity } from "../../store/playerIdentity.js";
import { formatGameDateShort, tickToGameDate } from "../../store/gameTime.js";
import type { SaveInfo } from "../../store/persist.js";
import gameBannerUrl from "@assets/images/game-banner-001.jpg";
import gameBannerMobileUrl from "@assets/images/game-banner-001-mobile.jpg";
import styles from "./StartScreen.module.css";

interface StartScreenProps {
  hasSavedGame: boolean;
  latestSave: SaveInfo | null;
  playerIdentity: StoredPlayerIdentity | null;
  usernameDraft: string;
  statusMessage: string | null;
  startError: string | null;
  isStarting: boolean;
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onUsernameDraftChange: (username: string) => void;
  onPlay: () => void | Promise<void>;
  onLoadGame: () => void;
  onNewGame: () => void | Promise<void>;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function StartScreen({
  hasSavedGame,
  latestSave,
  playerIdentity,
  usernameDraft,
  statusMessage,
  startError,
  isStarting,
  selectedDifficulty,
  onSelectDifficulty,
  onUsernameDraftChange,
  onPlay,
  onLoadGame,
  onNewGame,
}: StartScreenProps) {
  const latestSaveDate = latestSave
    ? timestampFormatter.format(new Date(latestSave.updatedAt))
    : null;
  const latestGameDate = latestSave
    ? formatGameDateShort(tickToGameDate(latestSave.tick))
    : null;

  return (
    <main className={styles.root}>
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet={`${gameBannerMobileUrl} 900w, ${gameBannerUrl} 1376w`}
          sizes="100vw"
        />
        <img
          className={styles.bannerImage}
          src={gameBannerUrl}
          srcSet={`${gameBannerMobileUrl} 900w, ${gameBannerUrl} 1376w`}
          sizes="100vw"
          decoding="async"
          loading="eager"
          alt=""
          aria-hidden="true"
        />
      </picture>

      <div className={styles.overlay} />

      <section className={styles.panel} aria-label="Start Datacenter Tycoon">
        <p className={styles.description}>
          Build facilities, scale capacity, and outbid the grid while you chase the
          most profitable contracts on the map.
        </p>

        <div className={styles.difficultySection}>
          <div className={styles.saveSummaryLabel}>Difficulty</div>
          <div className={styles.difficultyOptions} role="radiogroup" aria-label="Difficulty">
            {(["easy", "hard"] as Difficulty[]).map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                role="radio"
                aria-checked={selectedDifficulty === difficulty}
                className={[
                  styles.difficultyOption,
                  selectedDifficulty === difficulty ? styles.difficultyOptionActive : "",
                ].join(" ")}
                onClick={() => onSelectDifficulty(difficulty)}
              >
                {difficulty.toUpperCase()}
              </button>
            ))}
          </div>
          <p className={styles.difficultyHint}>
            {selectedDifficulty === "easy"
              ? "Easy starts with extra cash and gentler failure, repair, and penalty rules."
              : "Hard matches the default economy with tougher failures, repairs, and breach penalties."}
          </p>
        </div>

        {playerIdentity ? (
          <div className={styles.identityCard}>
            <div className={styles.saveSummaryLabel}>Online identity</div>
            <div className={styles.saveSummaryValue}>{playerIdentity.username}</div>
            <p className={styles.identityHint}>
              This browser will submit future leaderboard runs as this player.
            </p>
          </div>
        ) : (
          <div className={styles.identitySection}>
            <label className={styles.identityLabel} htmlFor="start-username">
              Leaderboard name
            </label>
            <input
              id="start-username"
              className={styles.identityInput}
              type="text"
              autoComplete="nickname"
              spellCheck={false}
              maxLength={24}
              value={usernameDraft}
              onChange={(event) => onUsernameDraftChange(event.target.value)}
              placeholder="Acme Cloud"
            />
            <p className={styles.identityHint}>
              Pick a unique display name for this browser before your first run. Once claimed,
              nobody else can use that leaderboard name. If the backend is down, you can still
              keep playing locally.
            </p>
          </div>
        )}

        {statusMessage && (
          <div className={styles.statusMessage} role="status">
            {statusMessage}
          </div>
        )}

        {startError && (
          <div className={styles.errorMessage} role="alert">
            {startError}
          </div>
        )}

        {hasSavedGame ? (
          <>
            {latestSave && (
              <div className={styles.saveSummary}>
                <div className={styles.saveSummaryLabel}>Latest save</div>
                <div className={styles.saveSummaryValue}>{latestSave.playerName}</div>
                <div className={styles.saveMetaGrid}>
                  <div>
                    <span className={styles.metaLabel}>Cash</span>
                    <span className={styles.metaValue}>
                      {currencyFormatter.format(latestSave.cash)}
                    </span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>In-game date</span>
                    <span className={styles.metaValue}>{latestGameDate}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Last saved</span>
                    <span className={styles.metaValue}>{latestSaveDate}</span>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.primaryAction} onClick={onLoadGame}>
                Load Game
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={onNewGame}
                disabled={isStarting}
              >
                {isStarting ? "Starting…" : "New Game"}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.playAction}
              onClick={onPlay}
              disabled={isStarting}
            >
              {isStarting ? "Starting…" : "Play"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
