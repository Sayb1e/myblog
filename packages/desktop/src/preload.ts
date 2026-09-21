import { contextBridge, ipcRenderer } from "electron";

export interface TerminalOptions {
  cwd?: string;
  cols?: number;
  rows?: number;
}

contextBridge.exposeInMainWorld("myblog", {
  desktop: true,
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory") as Promise<string | null>,
  setTheme: (theme: "dark" | "light" | "system") => ipcRenderer.send("theme:set", theme),
  windowControls: {
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    close: () => ipcRenderer.send("window:close"),
    onMaximized: (listener: (maximized: boolean) => void) => {
      ipcRenderer.on("window:maximized", (_event, maximized: boolean) => listener(maximized));
    },
  },
  terminal: {
    create: (options: TerminalOptions) =>
      ipcRenderer.invoke("terminal:create", options) as Promise<{ id: number; shell: string }>,
    write: (id: number, data: string) => ipcRenderer.send("terminal:write", { id, data }),
    resize: (id: number, cols: number, rows: number) => ipcRenderer.send("terminal:resize", { id, cols, rows }),
    kill: (id: number) => ipcRenderer.send("terminal:kill", { id }),
    onData: (listener: (payload: { id: number; data: string }) => void) => {
      ipcRenderer.on("terminal:data", (_event, payload: { id: number; data: string }) => listener(payload));
    },
    onExit: (listener: (payload: { id: number }) => void) => {
      ipcRenderer.on("terminal:exit", (_event, payload: { id: number }) => listener(payload));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners("terminal:data");
      ipcRenderer.removeAllListeners("terminal:exit");
    },
  },
});
