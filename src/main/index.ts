import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { openDatabase } from "./db/connection";
import { registerAllHandlers } from "./ipc";

function isAllowedNavigation(url: string): boolean {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) {
    return url.startsWith(devServer);
  }
  return url.startsWith("file://");
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  // Block navigation away from the app and open external links in the browser.
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  const databasePath =
    process.env.STOCKBILL_DB ?? join(app.getPath("userData"), "stockbill.db");
  const db = openDatabase(databasePath);
  registerAllHandlers(db);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
