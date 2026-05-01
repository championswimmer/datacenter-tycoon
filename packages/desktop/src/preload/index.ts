import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../main/ipc.js";

export interface DesktopApi {
  readonly isDesktop: true;
  getAppVersion(): Promise<string>;
  getPlatform(): Promise<NodeJS.Platform>;
}

const desktopApi: DesktopApi = {
  isDesktop: true,
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getAppVersion) as Promise<string>,
  getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.getPlatform) as Promise<NodeJS.Platform>,
};

contextBridge.exposeInMainWorld("desktop", desktopApi);
