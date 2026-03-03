const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (content, filePath) => ipcRenderer.invoke('save-file', content, filePath),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
  writeClipboardImage: (dataUrl) => ipcRenderer.invoke('write-clipboard-image', dataUrl),
  getFileData: (filePath) => ipcRenderer.invoke('get-file-data', filePath),
  setDirty: (value) => ipcRenderer.send('set-dirty', value),
  
  // YouTube Downloader IPC
  youtubeDownload: (data) => ipcRenderer.send('youtube-download', data),
  onYoutubeProgress: (callback) => ipcRenderer.on('youtube-progress', (_, data) => callback(data)),
  onYoutubeComplete: (callback) => ipcRenderer.on('youtube-complete', (_, data) => callback(data)),
  onYoutubeError: (callback) => ipcRenderer.on('youtube-error', (_, data) => callback(data)),
  selectDownloadFolder: () => ipcRenderer.invoke('select-download-folder'),
});
