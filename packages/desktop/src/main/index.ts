import { app, BrowserWindow } from "electron";
import { DESKTOP_PRODUCT_NAME } from "../shared/constants.js";
import { registerAppIpcHandlers } from "./ipc.js";
import { createMainWindow } from "./window.js";

app.setName(DESKTOP_PRODUCT_NAME);

app.whenReady().then(async () => {
  registerAppIpcHandlers();
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
