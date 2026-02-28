const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Debug logging for auto-updater
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "debug";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  autoUpdater.checkForUpdatesAndNotify();
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