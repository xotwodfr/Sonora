/**
 * Sonora desktop shell.
 *
 * Starts the Sonora backend inside this process (bound to 127.0.0.1 only), serves
 * the built frontend from it, and shows it in a window. Settings, the library
 * database and the artwork cache live in the per-user app-data folder.
 */
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Stable origin => the UI's saved preferences (localStorage) survive restarts.
const PREFERRED_PORT = 38471;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;
let backend = null;
let origin = '';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(main).catch(fatal);
}

function fatal(err) {
  dialog.showErrorBox('Sonora could not start', err && err.stack ? err.stack : String(err));
  app.exit(1);
}

async function startBackend() {
  process.env.SONORA_DESKTOP = '1';
  process.env.DATA_PATH = path.join(app.getPath('userData'), 'data');
  // Imported only now: the backend reads its configuration from the environment at load time.
  const { startServer } = await import(pathToFileURL(path.join(__dirname, 'server', 'server.js')).href);
  const opts = { host: '127.0.0.1', staticDir: path.join(__dirname, 'web'), desktop: true };
  try {
    return await startServer({ ...opts, port: PREFERRED_PORT });
  } catch (err) {
    if (err && err.code !== 'EADDRINUSE') throw err;
    return startServer({ ...opts, port: 0 }); // preferred port taken by another program
  }
}

async function main() {
  Menu.setApplicationMenu(null);
  backend = await startBackend();
  origin = `http://127.0.0.1:${backend.port}`;

  ipcMain.handle('sonora:choose-folder', async (event) => {
    // Only our own page may open the dialog.
    if (!event.senderFrame || !event.senderFrame.url.startsWith(origin)) return null;
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose your music folder',
      properties: ['openDirectory'],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 600,
    backgroundColor: '#0b0b0f',
    title: 'Sonora',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Links to other sites (lyrics credits) open in the user's browser, never in the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(origin);
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  if (backend) {
    const b = backend;
    backend = null;
    b.close().catch(() => {});
  }
});
