import styles from "./FinancesPage.module.css";

export function FinancesPage() {
  return (
    <section className={styles.page} aria-label="Finances">
      <div className={styles.header}>
        <h2 className={styles.title}>FINANCES</h2>
        <p className={styles.subtitle}>Monthly cashflow history and revenue breakdowns.</p>
      </div>
    </section>
  );
}
