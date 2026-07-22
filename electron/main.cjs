const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const PORT = process.env.CRM_DESKTOP_PORT || "3210";
const address = `http://127.0.0.1:${PORT}`;
let nextServer;

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(address, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (retries-- <= 0) return reject(new Error("O servidor local nao iniciou."));
        setTimeout(probe, 500);
      });
      request.setTimeout(1000, () => request.destroy());
    };
    probe();
  });
}

function startServer() {
  if (!app.isPackaged) return Promise.resolve("http://localhost:3000");

  const server = path.join(app.getAppPath(), ".next", "standalone", "server.js");
  nextServer = spawn(process.execPath, [server], {
    cwd: app.getAppPath(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT, HOSTNAME: "127.0.0.1" },
    windowsHide: true,
    stdio: "ignore",
  });
  return waitForServer().then(() => address);
}

function createWindow(url) {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  window.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
  window.loadURL(url);
}

app.whenReady().then(async () => createWindow(await startServer()));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => nextServer?.kill());
