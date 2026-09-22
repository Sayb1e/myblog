import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from "electron";
import * as pty from "node-pty";
import { resolveInside } from "@myblog/agent";
import { createApi, type ChatStreamPayload, type MyBlogApi } from "@myblog/server";

const here = path.dirname(fileURLToPath(import.meta.url));
const smoke = Boolean(process.env.MYBLOG_DESKTOP_SMOKE);

let api: MyBlogApi | null = null;
let win: BrowserWindow | null = null;
let currentRoot = "";
let disposeWatch: (() => void) | null = null;

const terminals = new Map<number, pty.IPty>();
const chats = new Map<string, AbortController>();
let terminalSeq = 0;

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

function watchWorkspace(): void {
  disposeWatch?.();
  disposeWatch = api?.watchChanges(() => broadcast("myblog:fs-change", Date.now())) ?? null;
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

function registerIpc(): void {
  ipcMain.handle("myblog:invoke", async (_event, method: string, payload?: unknown) => {
    if (!api) throw new Error("MyBlog 尚未初始化");
    return api.dispatch(method, payload);
  });

  ipcMain.handle("myblog:chat", async (event, payload: { streamId: string } & ChatStreamPayload) => {
    if (!api) throw new Error("MyBlog 尚未初始化");
    const controller = new AbortController();
    chats.set(payload.streamId, controller);
    try {
      await api.streamChat(payload, (chatEvent) => {
        if (event.sender.isDestroyed()) return;
        event.sender.send("myblog:chat-event", { streamId: payload.streamId, event: chatEvent });
      }, controller.signal);
    } finally {
      chats.delete(payload.streamId);
    }
  });

  ipcMain.on("myblog:chat-cancel", (_event, streamId: string) => {
    chats.get(streamId)?.abort();
  });

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

  ipcMain.handle("shell:absolute", (_event, relative: string) => {
    if (!api) throw new Error("MyBlog 尚未初始化");
    return resolveInside(api.activeRoot(), relative);
  });

  ipcMain.on("shell:reveal", (_event, relative: string) => {
    if (!api) return;
    try {
      shell.showItemInFolder(resolveInside(api.activeRoot(), relative));
    } catch {
      // outside the workspace — ignore
    }
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

async function promptRoot(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: "选择学习库（含「PROGRESS.md」的目录）",
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
  await win.loadFile(path.join(webRoot(), "index.html"));
}

async function switchWorkspace(): Promise<void> {
  const picked = await promptRoot();
  if (!picked) return;
  await writeConfig(picked);
  await api?.dispatch("addWorkspace", { path: picked });
  watchWorkspace();
  win?.webContents.reload();
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
        { label: "项目主页", click: () => void shell.openExternal("https://github.com/Sayb1e/myblog") },
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

  currentRoot = root;
  api = createApi({
    root,
    agentConfigPath: agentConfigPath(),
    historyDir: historyDir(),
    onRootChange: (next) => {
      currentRoot = next;
      watchWorkspace();
    },
  });
  watchWorkspace();
  buildMenu();
  registerIpc();
  await createWindow();

  if (smoke) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    const evaluated = process.env.MYBLOG_DESKTOP_EVAL;
    if (evaluated) {
      const value = await win?.webContents.executeJavaScript(evaluated).catch((error: unknown) => String(error));
      console.log(`SMOKE_EVAL=${typeof value === "string" ? value : JSON.stringify(value)}`);
    }
    const text = await win?.webContents.executeJavaScript("document.body.innerText").catch(() => "");
    console.log(`SMOKE_OK root=${currentRoot} version=${api.version}`);
    console.log(`SMOKE_TEXT=${String(text ?? "").replace(/\s+/g, " ").slice(0, 240)}`);
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
    if (BrowserWindow.getAllWindows().length === 0 && currentRoot !== "") void createWindow();
  });

  app.on("before-quit", () => {
    for (const term of terminals.values()) term.kill();
    terminals.clear();
    for (const controller of chats.values()) controller.abort();
    chats.clear();
    disposeWatch?.();
    disposeWatch = null;
  });
}
