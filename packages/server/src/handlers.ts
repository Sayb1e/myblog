import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import {
  LIST_LIMIT,
  READ_LIMIT,
  SKIP_DIRS,
  isBinary,
  resolveInside,
  runAgent,
  saveAgentConfig,
  toRelative,
  viewAgentConfig,
  type AgentConfigView,
  type AgentEvent,
} from "@myblog/agent";
import {
  Workspace,
  buildPlan,
  emptyStatus,
  updateProgress,
  type CheckResult,
  type CloseDayInput,
  type CloseDayResult,
  type ProgressSnapshot,
  type ScaffoldOptions,
  type SummaryDoc,
  type TodayPlan,
  type WorkspaceStatus,
} from "@myblog/core";
import { createWorkspaceWatcher } from "./watcher.js";
import {
  activateSession,
  createSession,
  deleteSession,
  listSessions,
  readActive,
  renameSession,
  writeActive,
  type SessionMeta,
  type StoredMessage,
} from "./history.js";
import { defaultStorageSettings, readStorage, writeStorage, type StorageSettings } from "./storage.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const exec = promisify(execFile);

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
};

const IMAGE_LIMIT = 8 * 1024 * 1024;
const SEARCH_FILES = 400;

interface OpencodeProvider {
  id: string;
  label: string;
  baseURL: string;
  model: string;
}

const OPENCODE_PROVIDERS: OpencodeProvider[] = [
  { id: "opencode-go", label: "OpenCode Go", baseURL: "https://opencode.ai/zen/go/v1", model: "grok-4.6" },
  { id: "opencode", label: "OpenCode Zen", baseURL: "https://opencode.ai/zen/v1", model: "grok-code" },
];

function opencodeAuthFile(explicit?: string): string {
  if (explicit) return explicit;
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const xdg = process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
  return path.join(xdg, "opencode", "auth.json");
}

const require = createRequire(import.meta.url);
const VERSION = (require("../package.json") as { version?: string }).version ?? "0.0.0";

export interface StatusResponse extends WorkspaceStatus {
  root: string;
  version: string;
  initialized: boolean;
}

export interface WorkspaceList {
  active: string;
  list: string[];
}

export interface SessionList {
  active: string;
  sessions: SessionMeta[];
}

export interface StorageView extends StorageSettings {
  defaults: StorageSettings;
}

export interface ApiOptions {
  root: string;
  agentConfigPath?: string;
  historyDir?: string;
  workspaces?: string[];
  opencodeAuthPath?: string;
  onRootChange?: (root: string) => void;
}

export interface ChatStreamPayload {
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface FileEntry {
  name: string;
  type: "dir" | "file";
  size: number;
  path: string;
}

export interface FileListing {
  path: string;
  entries: FileEntry[];
  truncated: boolean;
}

export interface FileContent {
  path: string;
  size: number;
  truncated: boolean;
  binary: boolean;
  content: string;
  mime?: string;
  dataUrl?: string;
}

export interface SearchHit {
  path: string;
  date: string | null;
  line: number;
  text: string;
}

export interface GitState {
  isRepo: boolean;
  branch: string;
  dirty: number;
  lastCommit: string;
  suggested: string;
}

export interface OpencodeAuthView {
  file: string;
  available: OpencodeProvider[];
}

export interface MyBlogHandlers {
  status: () => Promise<StatusResponse>;
  init: () => Promise<{ created: string[] }>;
  workspaces: () => Promise<WorkspaceList>;
  addWorkspace: (payload: { path: string }) => Promise<WorkspaceList>;
  setWorkspace: (payload: { path: string }) => Promise<WorkspaceList>;
  check: () => Promise<CheckResult>;
  today: () => Promise<TodayPlan>;
  summaries: () => Promise<SummaryDoc[]>;
  summary: (payload: { date: string }) => Promise<{ exists: boolean; summary: SummaryDoc | null }>;
  saveSummary: (payload: { date: string; content: string }) => Promise<{ ok: true; path: string }>;
  patchProgress: (payload: Partial<ProgressSnapshot>) => Promise<{ ok: true; changed: boolean }>;
  scaffold: (payload: { date: string } & ScaffoldOptions) => Promise<{ created: boolean; path: string }>;
  close: (payload: CloseDayInput & { dryRun?: boolean }) => Promise<CloseDayResult>;
  files: (payload?: { path?: string }) => Promise<FileListing>;
  readFile: (payload: { path: string }) => Promise<FileContent>;
  search: (payload: { query: string; limit?: number }) => Promise<{ query: string; hits: SearchHit[] }>;
  setCapability: (payload: { id: string; status: string }) => Promise<{ ok: true; changed: boolean }>;
  git: () => Promise<GitState>;
  gitCommit: (payload: { message: string }) => Promise<{ ok: true; output: string }>;
  opencodeAuth: () => Promise<OpencodeAuthView>;
  importOpencode: (payload?: { provider?: string }) => Promise<{ ok: true; provider: string; baseURL: string; model: string }>;
  agent: () => Promise<AgentConfigView>;
  saveAgent: (payload: { baseURL?: string; model?: string; apiKey?: string; temperature?: number }) => Promise<AgentConfigView>;
  storage: () => Promise<StorageView>;
  saveStorage: (payload: { agentConfigPath?: string; historyDir?: string }) => Promise<StorageView>;
  sessions: () => Promise<SessionList>;
  createSession: (payload?: { title?: string }) => Promise<SessionList & { session: SessionMeta }>;
  activateSession: (payload: { id: string }) => Promise<SessionList>;
  renameSession: (payload: { id: string; title: string }) => Promise<SessionList>;
  deleteSession: (payload: { id: string }) => Promise<SessionList>;
  history: () => Promise<{ session: SessionMeta | null; messages: StoredMessage[] }>;
  saveHistory: (payload: { messages: StoredMessage[] }) => Promise<{ ok: true }>;
  clearHistory: () => Promise<{ ok: true }>;
}

export type ApiMethod = keyof MyBlogHandlers;
export type ApiPayload<M extends ApiMethod> = Parameters<MyBlogHandlers[M]>[0];
export type ApiResult<M extends ApiMethod> = Awaited<ReturnType<MyBlogHandlers[M]>>;

export interface MyBlogApi {
  version: string;
  activeRoot: () => string;
  dispatch: (method: string, payload?: unknown) => Promise<unknown>;
  streamChat: (payload: ChatStreamPayload, emit: (event: AgentEvent) => void, signal: AbortSignal) => Promise<void>;
  watchChanges: (onChange: () => void) => () => void;
}

export function createApi(options: ApiOptions): MyBlogApi {
  const defaults: StorageSettings = defaultStorageSettings(path.resolve(options.root));
  if (options.agentConfigPath) defaults.agentConfigPath = options.agentConfigPath;
  if (options.historyDir) defaults.historyDir = options.historyDir;
  else if (process.env.MYBLOG_HISTORY_DIR) defaults.historyDir = process.env.MYBLOG_HISTORY_DIR;
  if (options.workspaces) {
    defaults.workspaces = [
      ...new Set([path.resolve(options.root), ...options.workspaces.map((entry) => path.resolve(entry))]),
    ];
  }
  const storageFile = path.join(path.dirname(defaults.agentConfigPath), "settings.json");

  let storage: StorageSettings | null = null;
  let currentRoot = defaults.activeWorkspace;

  const getStorage = async (): Promise<StorageSettings> => {
    if (!storage) {
      storage = await readStorage(storageFile, defaults);
      currentRoot = storage.activeWorkspace;
    }
    return storage;
  };
  const persist = async (next: StorageSettings): Promise<void> => {
    await writeStorage(storageFile, next);
    storage = next;
    if (next.activeWorkspace !== currentRoot) {
      currentRoot = next.activeWorkspace;
      options.onRootChange?.(currentRoot);
    } else {
      currentRoot = next.activeWorkspace;
    }
  };
  const get = async (): Promise<Workspace> => {
    await getStorage();
    return Workspace.load(currentRoot);
  };
  const setStorage = async (patch: { agentConfigPath?: string; historyDir?: string }): Promise<StorageSettings> => {
    const current = await getStorage();
    const next: StorageSettings = {
      agentConfigPath:
        typeof patch.agentConfigPath === "string" && patch.agentConfigPath !== ""
          ? path.resolve(patch.agentConfigPath)
          : current.agentConfigPath,
      historyDir:
        typeof patch.historyDir === "string" && patch.historyDir !== ""
          ? path.resolve(patch.historyDir)
          : current.historyDir,
      workspaces: current.workspaces,
      activeWorkspace: current.activeWorkspace,
    };
    await persist(next);
    return next;
  };

  const handlers: MyBlogHandlers = {
    status: async () => {
      const workspace = await get();
      const { initialized, status } = await workspace.readStatusSafe();
      return { root: workspace.root, version: VERSION, initialized, ...(status ?? emptyStatus()) };
    },

    init: async () => (await get()).initWorkspace(),

    workspaces: async () => {
      const current = await getStorage();
      return { active: current.activeWorkspace, list: current.workspaces };
    },

    addWorkspace: async (payload) => {
      if (!payload?.path) throw new Error("缺少 path");
      const resolved = path.resolve(payload.path);
      const current = await getStorage();
      const list = current.workspaces.includes(resolved) ? current.workspaces : [...current.workspaces, resolved];
      await persist({ ...current, workspaces: list, activeWorkspace: resolved });
      return { active: resolved, list };
    },

    setWorkspace: async (payload) => {
      if (!payload?.path) throw new Error("缺少 path");
      const resolved = path.resolve(payload.path);
      const current = await getStorage();
      if (!current.workspaces.includes(resolved)) throw new Error("该工作区不在白名单内");
      await persist({ ...current, activeWorkspace: resolved });
      return { active: resolved, list: current.workspaces };
    },

    check: async () => (await get()).check(),

    today: async () => {
      const workspace = await get();
      const { initialized, status } = await workspace.readStatusSafe();
      if (!initialized || !status) return buildPlan(emptyStatus(), null, ["overview"]);

      const missing: string[] = [];
      if (!(await workspace.hasGoals())) missing.push("goals");
      const lastDate = status.records[0]?.date ?? "";
      if (!lastDate) missing.push("latest-summary");

      let summary = null;
      if (lastDate) {
        try {
          summary = await workspace.readSummary(lastDate);
        } catch {
          summary = null;
        }
      }
      return buildPlan(status, summary, missing);
    },

    summaries: async () => {
      const workspace = await get();
      const entries = await readdir(workspace.root, { withFileTypes: true });
      const dates = entries
        .filter((entry) => entry.isDirectory() && DATE.test(entry.name))
        .map((entry) => entry.name)
        .sort()
        .reverse();

      const summaries: SummaryDoc[] = [];
      for (const date of dates) {
        try {
          summaries.push(await workspace.readSummary(date));
        } catch {
          continue;
        }
      }
      return summaries;
    },

    summary: async (payload) => {
      if (!payload?.date || !DATE.test(payload.date)) throw new Error("日期格式应为 YYYY-MM-DD");
      const workspace = await get();
      try {
        return { exists: true, summary: await workspace.readSummary(payload.date) };
      } catch {
        return { exists: false, summary: null };
      }
    },

    saveSummary: async (payload) => {
      if (!payload?.date || !DATE.test(payload.date)) throw new Error("日期格式应为 YYYY-MM-DD");
      if (typeof payload.content !== "string") throw new Error("缺少 content");
      const workspace = await get();
      await mkdir(workspace.dayDir(payload.date), { recursive: true });
      await writeFile(workspace.summaryPath(payload.date), payload.content, "utf8");
      return { ok: true, path: workspace.summaryPath(payload.date) };
    },

    patchProgress: async (payload) => {
      const patch: Partial<ProgressSnapshot> = {};
      if (payload?.learned !== undefined) patch.learned = payload.learned;
      if (payload?.next !== undefined) patch.next = payload.next;
      if (payload?.latest !== undefined) patch.latest = payload.latest;

      const workspace = await get();
      const raw = await readFile(workspace.overviewPath, "utf8");
      const next = updateProgress(raw, patch);
      if (next !== raw) await writeFile(workspace.overviewPath, next, "utf8");
      return { ok: true, changed: next !== raw };
    },

    scaffold: async (payload) => {
      if (!payload?.date || !DATE.test(payload.date)) throw new Error("日期格式应为 YYYY-MM-DD");
      const scaffold: ScaffoldOptions = {};
      if (payload.preview !== undefined) scaffold.preview = payload.preview;
      if (payload.next !== undefined) scaffold.next = payload.next;
      if (payload.skills !== undefined) scaffold.skills = payload.skills;
      return (await get()).scaffoldDay(payload.date, scaffold);
    },

    close: async (payload) => {
      if (!payload?.date || !DATE.test(payload.date)) throw new Error("日期格式应为 YYYY-MM-DD");
      const input: CloseDayInput = { date: payload.date };
      if (payload.learned !== undefined) input.learned = payload.learned;
      if (payload.next !== undefined) input.next = payload.next;
      if (payload.didWhat !== undefined) input.didWhat = payload.didWhat;
      if (payload.link !== undefined) input.link = payload.link;
      if (payload.linkText !== undefined) input.linkText = payload.linkText;
      if (payload.latest !== undefined) input.latest = payload.latest;
      return (await get()).closeDay(input, { dryRun: payload.dryRun });
    },

    files: async (payload) => {
      const workspace = await get();
      const absolute = resolveInside(workspace.root, payload?.path ?? ".");
      const info = await stat(absolute).catch(() => null);
      if (!info) throw new Error(`目录不存在：${toRelative(workspace.root, absolute)}`);
      if (!info.isDirectory()) throw new Error("这是文件，不是目录");

      const dirents = await readdir(absolute, { withFileTypes: true });
      const entries: FileEntry[] = [];
      for (const dirent of dirents) {
        const isDir = dirent.isDirectory();
        if (isDir && SKIP_DIRS.has(dirent.name)) continue;
        if (dirent.isSymbolicLink()) continue;
        const child = path.join(absolute, dirent.name);
        let size = 0;
        if (!isDir) {
          try {
            size = (await stat(child)).size;
          } catch {
            size = 0;
          }
        }
        entries.push({
          name: dirent.name,
          type: isDir ? "dir" : "file",
          size,
          path: toRelative(workspace.root, child),
        });
      }
      entries.sort((left, right) =>
        left.type === right.type ? left.name.localeCompare(right.name) : left.type === "dir" ? -1 : 1,
      );

      return {
        path: toRelative(workspace.root, absolute),
        entries: entries.slice(0, LIST_LIMIT),
        truncated: entries.length > LIST_LIMIT,
      };
    },

    readFile: async (payload) => {
      const workspace = await get();
      const absolute = resolveInside(workspace.root, payload?.path);
      const info = await stat(absolute).catch(() => null);
      if (!info || info.isDirectory()) throw new Error(`文件不存在：${toRelative(workspace.root, absolute)}`);

      const buffer = await readFile(absolute);
      const binary = isBinary(buffer);
      const mime = IMAGE_MIME[path.extname(absolute).toLowerCase()];
      const result: FileContent = {
        path: toRelative(workspace.root, absolute),
        size: info.size,
        truncated: buffer.length > READ_LIMIT,
        binary,
        content: binary && !mime ? "" : buffer.subarray(0, READ_LIMIT).toString("utf8"),
      };
      if (mime && buffer.length <= IMAGE_LIMIT) result.mime = mime;
      if (mime && buffer.length <= IMAGE_LIMIT) result.dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      return result;
    },

    search: async (payload) => {
      const query = (payload?.query ?? "").trim();
      if (query.length < 2) return { query, hits: [] };

      const workspace = await get();
      const needle = query.toLowerCase();
      const limit = Math.min(Math.max(payload.limit ?? 60, 1), 200);
      const hits: SearchHit[] = [];

      const targets: { absolute: string; rel: string; date: string | null }[] = [
        { absolute: workspace.overviewPath, rel: workspace.config.overview, date: null },
        { absolute: workspace.goalsPath, rel: workspace.config.goals, date: null },
      ];
      try {
        const entries = await readdir(workspace.root, { withFileTypes: true });
        const dates = entries
          .filter((entry) => entry.isDirectory() && DATE.test(entry.name))
          .map((entry) => entry.name)
          .sort()
          .reverse()
          .slice(0, SEARCH_FILES);
        for (const date of dates) {
          targets.push({
            absolute: workspace.summaryPath(date),
            rel: `${date}/${workspace.config.summaryFile}`,
            date,
          });
        }
      } catch {
        // workspace root unavailable
      }

      for (const target of targets) {
        if (hits.length >= limit) break;
        let raw: string;
        try {
          raw = await readFile(target.absolute, "utf8");
        } catch {
          continue;
        }
        const lines = raw.split(/\r?\n/);
        for (let index = 0; index < lines.length; index += 1) {
          const text = lines[index] ?? "";
          if (!text.toLowerCase().includes(needle)) continue;
          hits.push({
            path: target.rel.split(path.sep).join("/"),
            date: target.date,
            line: index + 1,
            text: text.trim().slice(0, 180),
          });
          if (hits.length >= limit) break;
        }
      }

      return { query, hits };
    },

    setCapability: async (payload) => {
      if (typeof payload?.id !== "string" || payload.id === "") throw new Error("缺少 id");
      if (typeof payload.status !== "string") throw new Error("缺少 status");
      const workspace = await get();
      const result = await workspace.setCapabilityStatus(payload.id, payload.status);
      return { ok: true, changed: result.changed };
    },

    git: async () => {
      const workspace = await get();
      const cwd = workspace.root;
      const empty: GitState = { isRepo: false, branch: "", dirty: 0, lastCommit: "", suggested: "" };

      try {
        const { stdout } = await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
        if (stdout.trim() !== "true") return empty;
      } catch {
        return empty;
      }

      const [branch, status, log] = await Promise.all([
        exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd }).catch(() => ({ stdout: "" })),
        exec("git", ["status", "--porcelain"], { cwd }).catch(() => ({ stdout: "" })),
        exec("git", ["log", "-1", "--pretty=%h %s"], { cwd }).catch(() => ({ stdout: "" })),
      ]);

      const dirty = status.stdout.split(/\r?\n/).filter((line) => line.trim() !== "").length;

      let suggested = "update workspace";
      const { status: workspaceStatus } = await workspace.readStatusSafe();
      if (workspaceStatus) {
        const record = workspaceStatus.records[0];
        const date = record?.date ?? "";
        let skills: string[] = [];
        if (date) {
          try {
            skills = (await workspace.readSummary(date)).skills;
          } catch {
            skills = [];
          }
        }
        const stage = workspaceStatus.stageIds.join(" ");
        suggested = [`close ${date || "workspace"}`, skills.length > 0 ? skills.join(" ") : stage, record?.didWhat ?? ""]
          .filter((part) => part !== "")
          .join(" ")
          .slice(0, 120);
      }

      return {
        isRepo: true,
        branch: branch.stdout.trim(),
        dirty,
        lastCommit: log.stdout.trim(),
        suggested,
      };
    },

    gitCommit: async (payload) => {
      const message = (payload?.message ?? "").trim();
      if (message === "") throw new Error("提交信息不能为空");
      const workspace = await get();
      const cwd = workspace.root;

      try {
        await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
      } catch {
        throw new Error("当前工作区不是 git 仓库");
      }

      await exec("git", ["add", "-A"], { cwd, maxBuffer: 8 * 1024 * 1024 });
      try {
        const { stdout } = await exec("git", ["commit", "-m", message], { cwd, maxBuffer: 8 * 1024 * 1024 });
        return { ok: true, output: stdout.trim() };
      } catch (error) {
        const detail =
          typeof error === "object" && error !== null && "stdout" in error
            ? String((error as { stdout?: unknown }).stdout ?? "")
            : "";
        const combined = `${detail}\n${error instanceof Error ? error.message : String(error)}`;
        if (/nothing to commit|无文件要提交|没有要提交/.test(combined)) throw new Error("没有需要提交的改动");
        throw new Error(combined.split(/\r?\n/).filter((line) => line.trim() !== "").slice(-3).join("\n"));
      }
    },

    agent: async () => viewAgentConfig((await getStorage()).agentConfigPath),

    opencodeAuth: async () => {
      const file = opencodeAuthFile(options.opencodeAuthPath);
      let raw: Record<string, { key?: string } | undefined> = {};
      try {
        raw = JSON.parse(await readFile(file, "utf8")) as Record<string, { key?: string } | undefined>;
      } catch {
        return { file, available: [] };
      }
      const available = OPENCODE_PROVIDERS.filter((entry) => {
        const key = raw[entry.id]?.key;
        return typeof key === "string" && key !== "";
      });
      return { file, available };
    },

    importOpencode: async (payload) => {
      const file = opencodeAuthFile(options.opencodeAuthPath);
      let raw: Record<string, { key?: string } | undefined> = {};
      try {
        raw = JSON.parse(await readFile(file, "utf8")) as Record<string, { key?: string } | undefined>;
      } catch {
        throw new Error(`没有找到 opencode 登录信息：${file}`);
      }

      const wanted =
        payload?.provider ??
        OPENCODE_PROVIDERS.find((entry) => {
          const key = raw[entry.id]?.key;
          return typeof key === "string" && key !== "";
        })?.id;
      const picked = OPENCODE_PROVIDERS.find((entry) => entry.id === wanted);
      if (!picked) throw new Error("opencode 里没有登录 OpenCode Go / Zen");

      const key = raw[picked.id]?.key;
      if (typeof key !== "string" || key === "") throw new Error(`opencode 里没有登录 ${picked.label}`);

      const configPath = (await getStorage()).agentConfigPath;
      await saveAgentConfig({ baseURL: picked.baseURL, model: picked.model, apiKey: key }, configPath);
      return { ok: true, provider: picked.id, baseURL: picked.baseURL, model: picked.model };
    },

    saveAgent: async (payload) => {
      const configPath = (await getStorage()).agentConfigPath;
      await saveAgentConfig(payload ?? {}, configPath);
      return viewAgentConfig(configPath);
    },

    storage: async () => ({ ...(await getStorage()), defaults }),

    saveStorage: async (payload) => ({ ...(await setStorage(payload ?? {})), defaults }),

    sessions: async () => listSessions(currentRoot, (await getStorage()).historyDir),

    createSession: async (payload) => createSession(currentRoot, (await getStorage()).historyDir, payload?.title),

    activateSession: async (payload) => activateSession(currentRoot, (await getStorage()).historyDir, payload.id),

    renameSession: async (payload) => {
      if (typeof payload?.title !== "string" || payload.title.trim() === "") throw new Error("缺少 title");
      return renameSession(currentRoot, (await getStorage()).historyDir, payload.id, payload.title);
    },

    deleteSession: async (payload) => deleteSession(currentRoot, (await getStorage()).historyDir, payload.id),

    history: async () => readActive(currentRoot, (await getStorage()).historyDir),

    saveHistory: async (payload) => {
      await writeActive(currentRoot, (await getStorage()).historyDir, Array.isArray(payload?.messages) ? payload.messages : []);
      return { ok: true };
    },

    clearHistory: async () => {
      await writeActive(currentRoot, (await getStorage()).historyDir, []);
      return { ok: true };
    },
  };

  const dispatch = async (method: string, payload?: unknown): Promise<unknown> => {
    const handler = (handlers as unknown as Record<string, ((input: unknown) => Promise<unknown>) | undefined>)[
      method
    ];
    if (typeof handler !== "function") throw new Error(`未知接口：${method}`);
    return handler.call(handlers, payload);
  };

  const streamChat = async (
    payload: ChatStreamPayload,
    emit: (event: AgentEvent) => void,
    signal: AbortSignal,
  ): Promise<void> => {
    const messages = (payload?.messages ?? [])
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") && typeof message.content === "string",
      )
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content ?? "" }));

    const workspace = await get();
    const agentConfigPath = (await getStorage()).agentConfigPath;
    for await (const event of runAgent({ workspace, messages, configPath: agentConfigPath, signal })) {
      if (signal.aborted) break;
      emit(event);
    }
  };

  const watchChanges = (onChange: () => void): (() => void) => createWorkspaceWatcher(currentRoot, onChange);

  return {
    version: VERSION,
    activeRoot: () => currentRoot,
    dispatch,
    streamChat,
    watchChanges,
  };
}
