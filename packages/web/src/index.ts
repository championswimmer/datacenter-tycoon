import { VERSION } from "@datacenter-tycoon/game-logic";

console.log("Datacenter Tycoon web — game-logic v" + VERSION);

export { VERSION };

// Store & persistence
export * from "./store/gameStore.js";
export * from "./store/tickDriver.js";
export * from "./store/selectors.js";
export * from "./store/ids.js";
export * from "./store/persist.js";
export * from "./store/useStore.js";
export * from "./store/storeContext.js";
export * from "./store/gameTime.js";
export * from "./store/tickFractionStore.js";
export * from "./store/playerIdentity.js";
export * from "./store/tutorialPersist.js";

// Online services & platform
export * from "./online/config.js";
export * from "./online/leaderboard.js";
export * from "./online/players.js";
export * from "./online/verified-run.js";
export * from "./platform/desktop.js";

// Audio & routing
export * from "./audio/AudioEngine.js";
export * from "./router/hashRouter.js";

// Theme primitives & common UI utilities
export * from "./theme/primitives/index.js";
export * from "./ui/responsive.js";
export * from "./ui/dialogFocus.js";

// Shared UI components, panels & modals
export { StartScreen } from "./ui/start/StartScreen.js";
export { useAppSession } from "./App.js";
export { LeaderboardDialog } from "./ui/start/LeaderboardDialog.js";
export { TutorialModal } from "./ui/help/TutorialModal.js";
export { AudioSettingsModal } from "./ui/settings/AudioSettingsModal.js";
export { ResetGameModal } from "./ui/topbar/ResetGameModal.js";
export { RackPicker } from "./ui/floor/RackPicker.js";
export type { RackPickerProps } from "./ui/floor/RackPicker.js";
export { MoveRackModal } from "./ui/floor/MoveRackModal.js";
export { NewDatacenterModal } from "./ui/onboarding/NewDatacenterModal.js";
export { InsufficientFunds } from "./ui/onboarding/InsufficientFunds.js";
export { ContractsPage } from "./ui/contracts/ContractsPage.js";
export { ActiveList } from "./ui/contracts/ActiveList.js";
export { MarketList } from "./ui/contracts/MarketList.js";
export { CompletedList } from "./ui/contracts/CompletedList.js";
export { FinancesPage } from "./ui/finances/FinancesPage.js";
export { PowerView } from "./ui/stats/PowerView.js";
export { UpgradePanel } from "./ui/stats/UpgradePanel.js";
export type { UpgradePanelFocus } from "./ui/stats/UpgradePanel.js";
export { ResourceBars } from "./ui/stats/ResourceBars.js";
export { CapacityTiles } from "./ui/stats/CapacityTiles.js";
export { LogFeed } from "./ui/log/LogFeed.js";
export { MapView } from "./ui/map/MapView.js";
export { RegionPanel } from "./ui/map/RegionPanel.js";
