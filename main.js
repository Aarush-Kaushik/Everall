const { app, BrowserWindow, dialog, ipcMain, clipboard, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Debug logging for auto-updater
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "debug";

let isDirty = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  win.loadFile('index.html');
  win.removeMenu();

  // Handle F11 for fullscreen
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key.toLowerCase() === 'f11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  win.on('close', (e) => {
    if (isDirty) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm',
        message: 'You have unsaved changes in the Code Editor. Are you sure you want to quit?'
      });
      if (choice === 1) e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  autoUpdater.checkForUpdatesAndNotify();

  // IPC handlers for code editor file operations
  ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return { path: filePath, content };
    } catch (e) {
      return { path: filePath, content: '', error: e.message };
    }
  });

  ipcMain.handle('save-file', async (_, content, filePath) => {
    if (filePath) {
      try {
        fs.writeFileSync(filePath, content, 'utf8');
        return { path: filePath };
      } catch (e) {
        return { error: e.message };
      }
    }
    const result = await dialog.showSaveDialog({});
    if (result.canceled || !result.filePath) return null;
    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { path: result.filePath };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('save-file-as', async (_, content) => {
    const result = await dialog.showSaveDialog({});
    if (result.canceled || !result.filePath) return null;
    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { path: result.filePath };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('read-clipboard-image', async () => {
    const img = clipboard.readImage();
    if (img.isEmpty()) return null;
    return img.toDataURL();
  });

  ipcMain.handle('read-clipboard-text', () => {
    return clipboard.readText();
  });

  ipcMain.handle('write-clipboard-image', (_, dataUrl) => {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
    return true;
  });

  ipcMain.on('set-dirty', (_, value) => {
    isDirty = value;
  });

  ipcMain.handle('get-file-data', async (_, filePath) => {
    try {
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1);
      const mime = filePath.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 
                   filePath.toLowerCase().endsWith('.wav') ? 'audio/wav' :
                   filePath.toLowerCase().endsWith('.mp4') ? 'video/mp4' :
                   filePath.toLowerCase().endsWith('.webm') ? 'video/webm' : 'application/octet-stream';
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch (e) {
      return null;
    }
  });
});

autoUpdater.on('update-available', () => {
  console.log('Update available.');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: '📦 A new version of Everall is available!',
    detail: 'The update will be downloaded and installed automatically.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded. Restarting...');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: '✅ Update downloaded and ready to install!',
    detail: 'The app will restart now to apply the update.',
    buttons: ['OK']
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});