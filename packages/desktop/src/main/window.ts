import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, shell } from "electron";
import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  DESKTOP_WINDOW_TITLE,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
} from "../shared/constants.js";
import { resolvePreloadPath, resolveRendererEntry } from "./paths.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export async function createMainWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    title: DESKTOP_WINDOW_TITLE,
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#071118",
    webPreferences: {
      preload: resolvePreloadPath(currentDir),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const rendererEntry = resolveRendererEntry(currentDir);

  if (rendererEntry.kind === "url") {
    await mainWindow.loadURL(rendererEntry.value);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(rendererEntry.value);
  }

  return mainWindow;
}
