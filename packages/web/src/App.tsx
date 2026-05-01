import { lazy, Suspense } from "react";
import { bootstrapStore } from "./store/persist.js";
import { StoreProvider } from "./store/storeContext.js";
import { Shell } from "./ui/shell/Shell.js";
import styles from "./App.module.css";

const ThemePlayground = lazy(
  () => import("./ui/theme-playground/index.js"),
);

// Bootstrap once — outside the component to survive HMR re-renders.
const { store } = bootstrapStore();

export default function App() {
  // Dev-only route — bypass shell entirely
  if (import.meta.env.DEV && window.location.hash === "#/__theme") {
    return (
      <Suspense fallback={<div className={styles.loading}>Loading…</div>}>
        <ThemePlayground />
      </Suspense>
    );
  }

  return (
    <StoreProvider store={store}>
      <Shell />
    </StoreProvider>
  );
}
