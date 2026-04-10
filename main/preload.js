const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder picker
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // File system
  readTree: (folderPath) => ipcRenderer.invoke('fs:readTree', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  writeFiles: (files) => ipcRenderer.invoke('fs:writeFiles', files),
  mkdir: (dirPath) => ipcRenderer.invoke('fs:mkdir', dirPath),
  restoreBackup: (filePath) => ipcRenderer.invoke('fs:restoreBackup', filePath),

  // Auth
  googleSignIn: () => ipcRenderer.invoke('auth:googleSignIn'),
  getRecaptchaToken: () => ipcRenderer.invoke('auth:getRecaptchaToken'),
  scanProject: (folderPath) => ipcRenderer.invoke('fs:scanProject', folderPath),
  buildGraph: (folderPath) => ipcRenderer.invoke('fs:buildGraph', folderPath),
  readPreviewBundle: (htmlPath) => ipcRenderer.invoke('fs:readPreviewBundle', htmlPath),
  watchFolder: (folderPath) => ipcRenderer.invoke('fs:watchFolder', folderPath),

  // Notepad
  notepadLoad: () => ipcRenderer.invoke('notepad:load'),
  notepadSave: (notes) => ipcRenderer.invoke('notepad:save', notes),

  // File watcher events
  onFolderChanged: (callback) => ipcRenderer.on('fs:folderChanged', (_, data) => callback(data)),
  onFileChanged: (callback) => ipcRenderer.on('fs:fileChanged', (_, data) => callback(data)),
  onFileRenamed: (callback) => ipcRenderer.on('fs:fileRenamed', (_, data) => callback(data)),
  removeWatchListeners: () => {
    ipcRenderer.removeAllListeners('fs:folderChanged');
    ipcRenderer.removeAllListeners('fs:fileChanged');
    ipcRenderer.removeAllListeners('fs:fileRenamed');
  },
});
