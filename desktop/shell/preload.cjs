const { contextBridge, ipcRenderer } = require('electron');

// The only thing the web UI may ask the desktop shell for: a native folder dialog.
contextBridge.exposeInMainWorld('sonoraDesktop', {
  chooseFolder: () => ipcRenderer.invoke('sonora:choose-folder'),
});
