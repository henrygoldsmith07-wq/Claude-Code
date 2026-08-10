const { app, BrowserWindow, ipcMain, desktopCapturer, session } = require("electron");
let autoUpdater = null;
try { autoUpdater = require("electron-updater").autoUpdater; } catch {}

const path = require("path");
const fs = require("fs");

const SETTINGS_PATH = () => path.join(app.getPath("userData"), "settings.json");

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH(), "utf8"));
  } catch {
    return { appUrl: "http://localhost:3000", apiKey: "" };
  }
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(settings, null, 2));
  return settings;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 640,
    resizable: false,
    title: "Meeting Recorder",
    backgroundColor: "#0b0d12",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

// IPC: enumerate capturable screens/windows for the picker.
ipcMain.handle("sources:list", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 240, height: 135 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

ipcMain.handle("settings:get", () => readSettings());
ipcMain.handle("settings:set", (_e, settings) => writeSettings(settings));

app.whenReady().then(() => {
  // Grant loopback/display capture without a system prompt where supported.
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
        // 'loopback' includes Windows system audio in the captured stream.
        callback({ video: sources[0], audio: "loopback" });
      });
    },
    { useSystemPicker: false }
  );

  createWindow();
  if (autoUpdater) { try { autoUpdater.checkForUpdatesAndNotify().catch(()=>{}); } catch {} }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
