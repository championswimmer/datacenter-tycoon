import type { Difficulty } from "@datacenter-tycoon/game-logic";
import { formatGameDateShort, tickToGameDate } from "../../store/gameTime.js";
import type { SaveInfo } from "../../store/persist.js";
import gameBannerUrl from "@assets/images/game-banner-001.jpg";
import gameBannerMobileUrl from "@assets/images/game-banner-001-mobile.jpg";
import styles from "./StartScreen.module.css";

interface StartScreenProps {
  hasSavedGame: boolean;
  latestSave: SaveInfo | null;
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onPlay: () => void;
  onLoadGame: () => void;
  onNewGame: () => void;
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
  selectedDifficulty,
  onSelectDifficulty,
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
              <button type="button" className={styles.secondaryAction} onClick={onNewGame}>
                New Game
              </button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.playAction} onClick={onPlay}>
              Play
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
