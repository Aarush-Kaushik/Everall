const path = require('path');
const process = require('process');



const { app, BrowserWindow, dialog, ipcMain, clipboard, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const os = require('os');

const ffmpegStatic = require('ffmpeg-static');

const log = require('electron-log');

autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

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

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 5000);

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

  ipcMain.handle('select-download-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.on('set-dirty', (_, value) => {
    isDirty = value;
  });

  const downloadFolder = path.join(os.homedir(), 'Downloads');

  // YouTube Download Handler
  ipcMain.on('youtube-download', async (event, data) => {
    const { id, url, format, type, downloadLocation } = data;
    const folder = downloadLocation || path.join(os.homedir(), 'Downloads');

    try {
      event.sender.send('youtube-progress', {
        id,
        progress: 10,
        status: 'Fetching video info...'
      });

      await downloadYoutube(id, url, format, event, folder);

    } catch (err) {
        log.error("FULL ERROR:", err);
        log.error("STDERR:", err.stderr);
        log.error("MESSAGE:", err.message);

        
        // Also log to a file
        const fs = require('fs');
        const logPath = require('path').join(require('os').homedir(), 'Downloads', 'yt-error.log');
        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] ${err.message}\n${err.stack}\n`);

        throw err;
    }
  });

  async function downloadYoutube(id, url, format, event, downloadFolder) {
  try {
    const path = require('path');
    const youtubedlFactory = require('youtube-dl-exec');

    const ytdlpPath = app.isPackaged
      ? path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          'youtube-dl-exec',
          'bin',
          'yt-dlp.exe'
        )
      : undefined;

    const youtubedl = ytdlpPath
      ? youtubedlFactory.create(ytdlpPath)
      : youtubedlFactory;  

    log.error("Using yt-dlp path: " + ytdlpPath);
    if (ytdlpPath) {
      log.error("Using yt-dlp path: " + ytdlpPath);
      log.error("Exists: " + fs.existsSync(ytdlpPath));
    } else {
      log.error("Using default yt-dlp (dev mode)");
    }

    const ffmpegStatic = require('ffmpeg-static');

    event.sender.send('youtube-progress', {
      id,
      progress: 30,
      status: 'Downloading video...'
    });

    // Get video info to extract title
    let videoTitle = 'Downloaded';
    try {
      const info = await youtubedl(url, {
        dumpSingleJson: true,
      });
      videoTitle = info.title || 'Downloaded';
    } catch (e) {
      console.log('Could not fetch title, using default');
    }

    const filename = format === 'mp3' ? '%(title)s.%(ext)s' : '%(title)s.%(ext)s';
    const output = path.join(downloadFolder, filename);
    
    const options = {
      output: output,
      ffmpegLocation: ffmpegStatic,
    };

    if (format === 'mp3') {
      options.extractAudio = true;
      options.audioFormat = 'mp3';
      options.audioQuality = '192';
    } else {
      options.format = 'best[ext=mp4]';
    }

    console.log('Downloading:', url);
    console.log('Options:', options);

    await youtubedl(url, options);

    event.sender.send('youtube-progress', {
      id,
      progress: 90,
      status: 'Finalizing...'
    });

    setTimeout(() => {
      event.sender.send('youtube-complete', {
        id,
        name: videoTitle
      });
    }, 1000);

  } catch (err) {
    log.error("FULL ERROR:", err);
    log.error("STDERR:", err.stderr);
    log.error("MESSAGE:", err.message);
    throw err;
  }
}

  ipcMain.handle('get-file-data', async (_, filePath) => {
    try {
      const data = fs.readFileSync(filePath);
      const mime =
        filePath.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' :
        filePath.toLowerCase().endsWith('.wav') ? 'audio/wav' :
        filePath.toLowerCase().endsWith('.mp4') ? 'video/mp4' :
        filePath.toLowerCase().endsWith('.webm') ? 'video/webm' :
        'application/octet-stream';

      return `data:${mime};base64,${data.toString('base64')}`;
    } catch (e) {
      return null;
    }
  });
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: '📦 A new version of Everall is available!',
    detail: 'The update will be downloaded and installed automatically.',
    buttons: ['OK']
  });
});

autoUpdater.on('update-downloaded', () => {
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
