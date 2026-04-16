const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: (startPath) => ipcRenderer.invoke('select-folder', startPath),
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
});
