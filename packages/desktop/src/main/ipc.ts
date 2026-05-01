import { app, ipcMain } from "electron";

export const IPC_CHANNELS = {
  getAppVersion: "app:getVersion",
  getPlatform: "app:getPlatform",
} as const;

export function registerAppIpcHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.getAppVersion);
  ipcMain.removeHandler(IPC_CHANNELS.getPlatform);

  ipcMain.handle(IPC_CHANNELS.getAppVersion, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.getPlatform, () => process.platform);
}
