import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  onNewDatacenter?: () => void;
}

export function EmptyState({ onNewDatacenter }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <div className={styles.art}>
        <span className={styles.artIcon}>▦</span>
        <div className={styles.artGrid}>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} className={styles.artCell} />
          ))}
        </div>
      </div>
      <h2 className={styles.title}>NO FACILITIES ONLINE</h2>
      <p className={styles.sub}>
        Build your first datacenter to start accepting contracts
        and growing your infrastructure empire.
      </p>
      <button className={styles.cta} onClick={onNewDatacenter}>
        + BUILD FIRST DATACENTER
      </button>
    </div>
  );
}
