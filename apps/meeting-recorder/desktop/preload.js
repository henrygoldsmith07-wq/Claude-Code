const { contextBridge, ipcRenderer } = require("electron");

// Minimal, explicit surface exposed to the renderer. No Node access leaks
// through contextIsolation; only these four channels are reachable.
contextBridge.exposeInMainWorld("recorder", {
  listSources: () => ipcRenderer.invoke("sources:list"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:set", settings),
});
