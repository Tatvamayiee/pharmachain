// PharmaChain Electron shell — loads the app from the backend on :41837
const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let win;
let serverProc;

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.cjs');
  serverProc = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  serverProc.on('error', (e) => console.error('server spawn error', e));
}

async function waitForServer(url, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { }
    await new Promise(r => setTimeout(r, 500));
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'PharmaChain',
    webPreferences: { contextIsolation: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadURL('http://localhost:41837');
}

app.whenReady().then(async () => {
  if (!process.env.PHARMACHAIN_NO_SERVER) startServer();
  await waitForServer('http://localhost:41837/api/health');
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (serverProc) serverProc.kill();
  if (process.platform !== 'darwin') app.quit();
});
