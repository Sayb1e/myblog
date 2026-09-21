import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from "electron";
import * as pty from "node-pty";
import { startServer } from "@myblog/server";

const here = path.dirname(fileURLToPath(import.meta.url));
const smoke = Boolean(process.env.MYBLOG_DESKTOP_SMOKE);

type Server = ReturnType<typeof startServer>;

let server: Server | null = null;
let win: BrowserWindow | null = null;
let currentRoot = "";
let currentPort = 0;

const terminals = new Map<number, pty.IPty>();
let terminalSeq = 0;

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

function spawnPty(cwd: string, cols: number, rows: number): pty.IPty {
  const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL ?? "/bin/bash";
  const args = process.platform === "win32" ? ["-NoLogo"] : [];
  const requested = cwd || process.cwd();
  const safeCwd = requested && existsSync(requested) ? requested : process.cwd();

  const options: pty.IWindowsPtyForkOptions = {
    name: "xterm-256color",
    cwd: safeCwd,
    cols,
    rows,
    env: process.env as Record<string, string>,
  };
  if (process.platform === "win32") {
    options.useConpty = false;
  }

  return pty.spawn(shell, args, options);
}

function registerTerminalIpc(): void {
  ipcMain.handle("terminal:create", (_event, options: { cwd?: string; cols?: number; rows?: number }) => {
    const term = spawnPty(options.cwd ?? currentRoot, options.cols ?? 80, options.rows ?? 24);
    const id = (terminalSeq += 1);
    terminals.set(id, term);
    term.onData((data) => broadcast("terminal:data", { id, data }));
    term.onExit(() => {
      terminals.delete(id);
      broadcast("terminal:exit", { id });
    });

    const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL ?? "/bin/bash";
    return { id, shell };
  });

  ipcMain.on("terminal:write", (_event, payload: { id: number; data: string }) => {
    terminals.get(payload.id)?.write(payload.data);
  });

  ipcMain.on("terminal:resize", (_event, payload: { id: number; cols: number; rows: number }) => {
    try {
      terminals.get(payload.id)?.resize(payload.cols, payload.rows);
    } catch {
      // resizing a dead pty is harmless
    }
  });

  ipcMain.on("terminal:kill", (_event, payload: { id: number }) => {
    const term = terminals.get(payload.id);
    if (!term) return;
    terminals.delete(payload.id);
    term.kill();
  });

  ipcMain.handle("dialog:pick-directory", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择目录",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  });

  ipcMain.on("theme:set", (_event, theme: "dark" | "light" | "system") => {
    if (theme !== "dark" && theme !== "light" && theme !== "system") return;
    nativeTheme.themeSource = theme;
    if (win) win.setBackgroundColor(theme === "light" ? "#f4f6fb" : "#0a0c11");
  });

  ipcMain.on("window:minimize", () => win?.minimize());
  ipcMain.on("window:toggle-maximize", () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window:close", () => win?.close());
}

function webRoot(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "web") : path.resolve(here, "../../web/dist");
}

function configPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

function agentConfigPath(): string {
  return path.join(app.getPath("userData"), "agent.json");
}

function historyDir(): string {
  return path.join(app.getPath("userData"), "history");
}

async function readConfig(): Promise<{ root?: string }> {
  try {
    return JSON.parse(await readFile(configPath(), "utf8")) as { root?: string };
  } catch {
    return {};
  }
}

async function writeConfig(root: string): Promise<void> {
  await writeFile(configPath(), JSON.stringify({ root }, null, 2), "utf8");
}

async function startWorkspace(root: string): Promise<number> {
  if (server) {
    const closing = server;
    server = null;
    await new Promise<void>((resolve) => closing.close(() => resolve()));
  }

  const started = startServer({
    root,
    port: 0,
    hostname: "127.0.0.1",
    webRoot: webRoot(),
    agentConfigPath: agentConfigPath(),
    historyDir: historyDir(),
  });
  await new Promise<void>((resolve) => {
    if (started.listening) resolve();
    else started.once("listening", () => resolve());
  });

  const address = started.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server = started;
  currentRoot = root;
  currentPort = port;
  return port;
}

async function promptRoot(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: "选择学习库（含「学习进度总览.md」的目录）",
    properties: ["openDirectory"],
  });
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
}

async function ensureRoot(): Promise<string | null> {
  const envRoot = process.env.MYBLOG_DESKTOP_ROOT;
  if (envRoot) return envRoot;

  const config = await readConfig();
  if (config.root) return config.root;
  const picked = await promptRoot();
  if (!picked) return null;
  await writeConfig(picked);
  return picked;
}

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0b0d12",
    title: "MyBlog",
    frame: false,
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.on("maximize", () => win?.webContents.send("window:maximized", true));
  win.on("unmaximize", () => win?.webContents.send("window:maximized", false));
  win.on("closed", () => {
    win = null;
  });
  await win.loadURL(`http://127.0.0.1:${currentPort}`);
}

async function switchWorkspace(): Promise<void> {
  const picked = await promptRoot();
  if (!picked) return;
  await writeConfig(picked);
  const port = await startWorkspace(picked);
  if (win) await win.loadURL(`http://127.0.0.1:${port}`);
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "文件",
      submenu: [
        { label: "切换学习库…", accelerator: "CmdOrCtrl+O", click: () => void switchWorkspace() },
        { label: "重新加载", accelerator: "CmdOrCtrl+R", click: () => win?.webContents.reload() },
        { type: "separator" },
        { label: "退出", accelerator: "CmdOrCtrl+Q", role: "quit" },
      ],
    },
    {
      label: "视图",
      submenu: [{ role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "关于 MyBlog",
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "关于 MyBlog",
              message: `MyBlog ${app.getVersion()}`,
              detail: `工作区：${currentRoot}\n模型配置与对话历史存放于应用数据目录。`,
            });
          },
        },
        { label: "项目主页", click: () => void shell.openExternal("https://github.com/") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function boot(): Promise<void> {
  const root = await ensureRoot();
  if (!root) {
    app.quit();
    return;
  }

  await startWorkspace(root);
  buildMenu();
  registerTerminalIpc();
  await createWindow();

  if (smoke) {
    console.log(`SMOKE_OK url=http://127.0.0.1:${currentPort} root=${currentRoot}`);
    if (process.env.MYBLOG_DESKTOP_SMOKE === "pty") {
      const term = spawnPty(currentRoot, 80, 24);
      let output = "";
      term.onData((data) => {
        output += data;
      });
      if (process.platform === "win32") {
        term.write("Write-Output PTY_OK\r");
      } else {
        term.write("echo PTY_OK\r");
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 4000);
        term.onExit(() => {
          clearTimeout(timer);
          resolve();
        });
      });
      console.log(`PTY_OK=${output.includes("PTY_OK")}`);
    }
    setTimeout(() => app.quit(), 1500);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app
    .whenReady()
    .then(boot)
    .catch((error: unknown) => {
      console.error(error);
      app.quit();
    });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && currentPort) void createWindow();
  });

  app.on("before-quit", () => {
    for (const term of terminals.values()) term.kill();
    terminals.clear();
    server?.close();
    server = null;
  });
}
