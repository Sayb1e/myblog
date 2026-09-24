import { contextBridge, ipcRenderer } from "electron";

export interface TerminalOptions {
  cwd?: string;
  cols?: number;
  rows?: number;
}

contextBridge.exposeInMainWorld("myblog", {
  desktop: true,
  state: () => ipcRenderer.invoke("myblog:state") as Promise<{ ready: boolean; root: string }>,
  setupWorkspace: (path: string) => ipcRenderer.invoke("myblog:setup", path) as Promise<{ root: string }>,
  createSampleWorkspace: (parent: string) =>
    ipcRenderer.invoke("myblog:setup-sample", parent) as Promise<{ root: string }>,
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory") as Promise<string | null>,
  absolutePath: (relative: string) => ipcRenderer.invoke("shell:absolute", relative) as Promise<string>,
  reveal: (relative: string) => ipcRenderer.send("shell:reveal", relative),
  setTheme: (theme: "dark" | "light" | "system") => ipcRenderer.send("theme:set", theme),
  windowControls: {
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    close: () => ipcRenderer.send("window:close"),
    onMaximized: (listener: (maximized: boolean) => void) => {
      ipcRenderer.on("window:maximized", (_event, maximized: boolean) => listener(maximized));
    },
  },
  api: {
    invoke: (method: string, payload?: unknown) => ipcRenderer.invoke("myblog:invoke", method, payload),
    chat: (payload: { streamId: string; messages: { role: "user" | "assistant"; content: string }[] }) =>
      ipcRenderer.invoke("myblog:chat", payload) as Promise<void>,
    cancelChat: (streamId: string) => ipcRenderer.send("myblog:chat-cancel", streamId),
    onChatEvent: (listener: (payload: { streamId: string; event: unknown }) => void) => {
      const wrapped = (_event: Electron.IpcRendererEvent, payload: { streamId: string; event: unknown }) =>
        listener(payload);
      ipcRenderer.on("myblog:chat-event", wrapped);
      return () => ipcRenderer.removeListener("myblog:chat-event", wrapped);
    },
    onFsChange: (listener: () => void) => {
      const wrapped = () => listener();
      ipcRenderer.on("myblog:fs-change", wrapped);
      return () => ipcRenderer.removeListener("myblog:fs-change", wrapped);
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
