import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_MAX_TOKENS,
  LIST_LIMIT,
  READ_LIMIT,
  SKIP_DIRS,
  draftGoals as draftGoalsAgent,
  inferFormat,
  isBinary,
  loadAgentConfig,
  resolveInside,
  runAgent,
  saveAgentConfig,
  streamCompletion,
  streamCompletionAnthropic,
  toRelative,
  validateGoalsDraft,
  type AgentConfig,
  type AgentConfigView,
  type AgentEvent,
  type GoalsDraftResult,
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
import { EMPTY_PLUGINS, loadPlugins, type LoadedPlugins, type PluginInfo } from "./plugins.js";
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
import {
  defaultStorageSettings,
  readStorage,
  writeStorage,
  type AgentProfile,
  type StorageSettings,
} from "./storage.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const WORKSPACE_AGENT_FILE = "myblog.agent.json";

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
  { id: "opencode-go", label: "OpenCode Go", baseURL: "https://opencode.ai/zen/go/v1", model: "deepseek-v4-flash" },
  { id: "opencode", label: "OpenCode Zen", baseURL: "https://opencode.ai/zen/v1", model: "glm-4.7" },
];

function opencodeAuthFile(explicit?: string): string {
  if (explicit) return explicit;
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const xdg = process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
  return path.join(xdg, "opencode", "auth.json");
}

function opencodeModelsFile(explicit?: string): string {
  if (explicit) return explicit;
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const xdg = process.env.XDG_CACHE_HOME ?? path.join(home, ".cache");
  return path.join(xdg, "opencode", "models.json");
}

function classifyOpencodeFormat(npm: unknown): OpencodeModel["format"] {
  if (npm === "@ai-sdk/anthropic") return "anthropic";
  if (npm === "@ai-sdk/openai-compatible" || npm === "@ai-sdk/openai") return "openai";
  return "other";
}

/** 读 opencode 的模型清单（models.json），标注每个模型需要的协议格式 */
async function readOpencodeModels(modelsFile: string, providerId: string): Promise<OpencodeModel[]> {
  try {
    const raw = JSON.parse(await readFile(modelsFile, "utf8")) as {
      providers?: Record<string, { npm?: string; models?: Record<string, { name?: string; provider?: { npm?: string } }> }>;
    };
    const provider = (raw.providers ?? {})[providerId];
    if (!provider?.models) return [];
    return Object.entries(provider.models)
      .map(([id, model]) => ({
        id,
        name: model?.name ?? id,
        format: classifyOpencodeFormat(model?.provider?.npm ?? provider.npm),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  } catch {
    return [];
  }
}

function workspaceAgentFile(root: string): string {
  return path.join(root, WORKSPACE_AGENT_FILE);
}

/** 本机推理（Ollama 等）不需要 API Key，可以视为已就绪 */
function isLocalBase(baseURL: string): boolean {
  try {
    const host = new URL(baseURL).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function asProfile(raw: unknown): AgentProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<AgentProfile>;
  if (typeof value.baseURL !== "string" || typeof value.model !== "string") return null;
  if (value.baseURL === "" || value.model === "") return null;
  const profile: AgentProfile = { baseURL: value.baseURL, model: value.model };
  if (typeof value.apiKey === "string" && value.apiKey !== "") profile.apiKey = value.apiKey;
  if (typeof value.temperature === "number") profile.temperature = value.temperature;
  return profile;
}

async function readWorkspaceAgentFile(root: string): Promise<AgentProfile | null> {
  try {
    return asProfile(JSON.parse(await readFile(workspaceAgentFile(root), "utf8")));
  } catch {
    return null;
  }
}

async function assertWritableConfigFile(input: string): Promise<void> {
  const resolved = path.resolve(input);
  if (path.parse(resolved).root === resolved) {
    throw new Error("模型配置要填一个文件路径（例如 D:\\Work\\myblog-agent.json），不能是盘符根目录");
  }
  const info = await stat(resolved).catch(() => null);
  if (info?.isDirectory()) {
    throw new Error("模型配置要填文件路径，不要填目录（例如 D:\\Work\\myblog-agent.json）");
  }
}

async function assertWritableHistoryDir(input: string): Promise<void> {
  const resolved = path.resolve(input);
  if (path.parse(resolved).root === resolved) {
    throw new Error("对话历史目录不能是盘符根目录，请选一个文件夹（例如 D:\\Work\\myblog-history）");
  }
  const info = await stat(resolved).catch(() => null);
  if (info && !info.isDirectory()) {
    throw new Error("对话历史要填目录路径，不能是文件");
  }
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
  names: Record<string, string>;
}

export interface SessionList {
  active: string;
  sessions: SessionMeta[];
}

export interface StorageView extends StorageSettings {
  defaults: StorageSettings;
}

export interface AgentView extends AgentConfigView {
  source: "env" | "workspace-file" | "profile" | "default";
  profile: string;
  profiles: string[];
  workspaceFile: string;
  /** 真的能用了：填了 baseURL/model，且（有 key 或本机地址） */
  ready: boolean;
}

export interface ApiOptions {
  root: string;
  agentConfigPath?: string;
  historyDir?: string;
  workspaces?: string[];
  opencodeAuthPath?: string;
  opencodeModelsPath?: string;
  /** 外部插件目录（每个子目录一个插件） */
  pluginsDir?: string;
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
  modelsFile: string;
  available: (OpencodeProvider & { models: OpencodeModel[] })[];
}

export interface OpencodeModel {
  id: string;
  name: string;
  /** 该模型在这个网关上需要的协议格式 */
  format: "openai" | "anthropic" | "other";
}

export interface MyBlogHandlers {
  status: () => Promise<StatusResponse>;
  init: () => Promise<{ created: string[] }>;
  workspaces: () => Promise<WorkspaceList>;
  addWorkspace: (payload: { path: string }) => Promise<WorkspaceList>;
  setWorkspace: (payload: { path: string }) => Promise<WorkspaceList>;
  renameWorkspace: (payload: { path: string; name: string }) => Promise<WorkspaceList>;
  removeWorkspace: (payload: { path: string }) => Promise<WorkspaceList>;
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
  importOpencode: (payload?: { provider?: string; model?: string }) => Promise<{
    ok: true;
    provider: string;
    baseURL: string;
    model: string;
    format: string;
  }>;
  agent: () => Promise<AgentView>;
  testAgent: (payload: {
    baseURL?: string;
    model?: string;
    apiKey?: string;
    format?: "openai" | "anthropic" | "auto";
  }) => Promise<{ ok: true; message: string }>;
  draftGoals: (payload: { text: string }) => Promise<GoalsDraftResult>;
  saveGoals: (payload: { content: string }) => Promise<{ ok: true; path: string; capabilities: number }>;
  saveAgent: (payload: {
    baseURL?: string;
    model?: string;
    apiKey?: string;
    temperature?: number;
    format?: "openai" | "anthropic" | "auto";
    maxTokens?: number;
    target?: "default" | "profile" | "workspace-file";
    profile?: string;
  }) => Promise<AgentView>;
  bindWorkspaceProfile: (payload: { profile?: string }) => Promise<{ bound: string }>;
  deleteProfile: (payload: { profile: string }) => Promise<{ ok: true }>;
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
  plugins: () => Promise<{ plugins: PluginInfo[]; commands: { id: string; title: string; hint: string }[] }>;
  runPluginCommand: (payload: { id: string }) => Promise<unknown>;
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

  const pluginsPromise: Promise<LoadedPlugins> = options.pluginsDir
    ? loadPlugins(options.pluginsDir)
    : Promise.resolve(EMPTY_PLUGINS);

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
      names: current.names,
      profiles: current.profiles,
      workspaceProfiles: current.workspaceProfiles,
    };
    await persist(next);
    return next;
  };

  const buildAgentView = (
    config: AgentProfile | AgentConfig,
    source: AgentView["source"],
    configPath: string,
    extras: { profile?: string; profiles?: string[]; workspaceFile?: string } = {},
  ): AgentView => {
    const configured = config.baseURL !== "" && config.model !== "";
    const hasApiKey = Boolean(config.apiKey);
    return {
      configured,
      ready: configured && (hasApiKey || isLocalBase(config.baseURL)),
      baseURL: config.baseURL,
      model: config.model,
      hasApiKey,
      configPath,
      format: inferFormat(config),
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      source,
      profile: extras.profile ?? "",
      profiles: extras.profiles ?? [],
      workspaceFile: extras.workspaceFile ?? "",
    };
  };

  const toAgentConfig = (profile: AgentProfile): AgentConfig => {
    const config: AgentConfig = { baseURL: profile.baseURL, model: profile.model, apiKey: profile.apiKey ?? "" };
    if (profile.temperature !== undefined) config.temperature = profile.temperature;
    if (profile.format !== undefined) config.format = profile.format;
    if (profile.maxTokens !== undefined) config.maxTokens = profile.maxTokens;
    return config;
  };

  const resolveAgent = async (): Promise<{
    config: AgentConfig;
    view: AgentView;
  }> => {
    const workspace = await get();
    const storage = await getStorage();
    const profiles = Object.keys(storage.profiles);
    const workspaceFile = workspaceAgentFile(workspace.root);

    const envBase = process.env.MYBLOG_AGENT_BASE_URL;
    const envModel = process.env.MYBLOG_AGENT_MODEL;
    if (envBase && envModel) {
      const config: AgentConfig = { baseURL: envBase, model: envModel, apiKey: process.env.MYBLOG_AGENT_API_KEY ?? "" };
      const envFormat = process.env.MYBLOG_AGENT_FORMAT;
      if (envFormat === "openai" || envFormat === "anthropic") config.format = envFormat;
      return { config, view: buildAgentView(config, "env", "（环境变量 MYBLOG_AGENT_*）", { profiles, workspaceFile }) };
    }

    const fromFile = await readWorkspaceAgentFile(workspace.root);
    if (fromFile) {
      return {
        config: toAgentConfig(fromFile),
        view: buildAgentView(fromFile, "workspace-file", workspaceFile, { profiles, workspaceFile }),
      };
    }

    const bound = storage.workspaceProfiles[workspace.root];
    if (bound) {
      const profile = storage.profiles[bound];
      if (profile) {
        return {
          config: toAgentConfig(profile),
          view: buildAgentView(profile, "profile", `${storage.agentConfigPath} → ${bound}`, {
            profile: bound,
            profiles,
            workspaceFile,
          }),
        };
      }
    }

    const fallback = (await loadAgentConfig(storage.agentConfigPath)) ?? { baseURL: "", model: "", apiKey: "" };
    return {
      config: fallback,
      view: buildAgentView(fallback, "default", storage.agentConfigPath, { profiles, workspaceFile }),
    };
  };

  const historyTarget = async (): Promise<{ dir: string; label?: string }> => {
    const storage = await getStorage();
    const label = storage.names[currentRoot];
    return label ? { dir: storage.historyDir, label } : { dir: storage.historyDir };
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
      return { active: current.activeWorkspace, list: current.workspaces, names: current.names };
    },

    addWorkspace: async (payload) => {
      if (!payload?.path) throw new Error("缺少 path");
      const resolved = path.resolve(payload.path);
      const current = await getStorage();
      const list = current.workspaces.includes(resolved) ? current.workspaces : [...current.workspaces, resolved];
      await persist({ ...current, workspaces: list, activeWorkspace: resolved });
      return { active: resolved, list, names: current.names };
    },

    setWorkspace: async (payload) => {
      if (!payload?.path) throw new Error("缺少 path");
      const resolved = path.resolve(payload.path);
      const current = await getStorage();
      if (!current.workspaces.includes(resolved)) throw new Error("该工作区不在白名单内");
      await persist({ ...current, activeWorkspace: resolved });
      return { active: resolved, list: current.workspaces, names: current.names };
    },

    renameWorkspace: async (payload) => {
      if (!payload?.path) throw new Error("缺少 path");
      const resolved = path.resolve(payload.path);
      const current = await getStorage();
      if (!current.workspaces.includes(resolved)) throw new Error("该工作区不在白名单内");

      const names = { ...current.names };
      const name = (payload.name ?? "").trim();
      if (name === "") delete names[resolved];
      else names[resolved] = name.slice(0, 60);

      await persist({ ...current, names });
      return { active: current.activeWorkspace, list: current.workspaces, names };
    },

    removeWorkspace: async (payload) => {
      if (!payload?.path) throw new Error("缺少 path");
      const resolved = path.resolve(payload.path);
      const current = await getStorage();
      if (!current.workspaces.includes(resolved)) throw new Error("该工作区不在白名单内");

      const list = current.workspaces.filter((entry) => entry !== resolved);
      if (list.length === 0) throw new Error("至少要保留一个工作区");

      const names = { ...current.names };
      delete names[resolved];
      const active = current.activeWorkspace === resolved ? (list[0] as string) : current.activeWorkspace;

      await persist({ ...current, workspaces: list, activeWorkspace: active, names });
      return { active, list, names };
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
      await workspace.backup(workspace.summaryPath(payload.date));
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
      if (next !== raw) {
        await workspace.backup(workspace.overviewPath);
        await writeFile(workspace.overviewPath, next, "utf8");
      }
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

    agent: async () => (await resolveAgent()).view,

    testAgent: async (payload) => {
      const saved = (await resolveAgent()).config;
      const baseURL = (payload?.baseURL ?? saved.baseURL).trim();
      const model = (payload?.model ?? saved.model).trim();
      const apiKey = payload?.apiKey ? payload.apiKey : saved.apiKey;
      if (baseURL === "" || model === "") throw new Error("先填 Base URL 和 Model");

      const config: AgentConfig = { baseURL, model, apiKey };
      if (payload?.format === "openai" || payload?.format === "anthropic") config.format = payload.format;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const stream = inferFormat(config) === "anthropic" ? streamCompletionAnthropic : streamCompletion;
      try {
        for await (const event of stream(config, [{ role: "user", content: "只回复：ok" }], [], controller.signal)) {
          if (event.type === "text") return { ok: true as const, message: event.text.trim().slice(0, 80) || "连接成功" };
        }
        return { ok: true as const, message: "连接成功" };
      } catch (caught) {
        if ((caught as Error).name === "AbortError") throw new Error("连接超时（15 秒没响应）");
        throw caught;
      } finally {
        clearTimeout(timer);
      }
    },

    draftGoals: async (payload) => {
      const text = (payload?.text ?? "").trim();
      if (text === "") throw new Error("先写点你想学的内容");
      const { config } = await resolveAgent();
      if (config.baseURL === "" || config.model === "") throw new Error("先在设置里配置模型");
      if (!config.apiKey && !isLocalBase(config.baseURL)) throw new Error("先在设置里填 API Key");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      try {
        return await draftGoalsAgent(config, { text }, { signal: controller.signal });
      } catch (caught) {
        if ((caught as Error).name === "AbortError") throw new Error("生成超时（60 秒没响应）");
        throw caught;
      } finally {
        clearTimeout(timer);
      }
    },

    saveGoals: async (payload) => {
      if (typeof payload?.content !== "string" || payload.content.trim() === "") throw new Error("内容不能为空");
      const validation = validateGoalsDraft(payload.content);
      if (!validation.ok) throw new Error(`学习目标格式有问题：${validation.problems.join("；")}`);
      const workspace = await get();
      await workspace.backup(workspace.goalsPath);
      await writeFile(workspace.goalsPath, payload.content, "utf8");
      return { ok: true as const, path: workspace.config.goals, capabilities: validation.capabilities };
    },

    saveAgent: async (payload) => {
      const storage = await getStorage();
      const workspace = await get();
      const profiles = Object.keys(storage.profiles);
      const workspaceFile = workspaceAgentFile(workspace.root);

      const patch: Partial<AgentConfig> = {};
      if (payload?.baseURL !== undefined) patch.baseURL = payload.baseURL;
      if (payload?.model !== undefined) patch.model = payload.model;
      if (payload?.apiKey !== undefined) patch.apiKey = payload.apiKey;
      if (payload?.temperature !== undefined) patch.temperature = payload.temperature;
      if (payload?.maxTokens !== undefined) patch.maxTokens = payload.maxTokens;

      const formatChoice = payload?.format;
      const applyFormat = <T extends { format?: "openai" | "anthropic" }>(target: T): T => {
        if (formatChoice === "auto") delete target.format;
        else if (formatChoice) target.format = formatChoice;
        return target;
      };

      const target = payload?.target ?? "default";

      if (target === "workspace-file") {
        const current = (await readWorkspaceAgentFile(workspace.root)) ?? { baseURL: "", model: "" };
        const next = applyFormat<AgentProfile>({ ...current, ...patch });
        if (next.baseURL === "" || next.model === "") throw new Error("工作区配置需要 baseURL 和 model");
        await writeFile(workspaceFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
        return buildAgentView(next, "workspace-file", workspaceFile, { profiles, workspaceFile });
      }

      if (target === "profile") {
        const name = (payload?.profile ?? "").trim();
        if (name === "") throw new Error("缺少配置档名字");
        const current = storage.profiles[name] ?? { baseURL: "", model: "" };
        const next = applyFormat<AgentProfile>({ ...current, ...patch });
        if (next.baseURL === "" || next.model === "") throw new Error("配置档需要 baseURL 和 model");
        await persist({ ...storage, profiles: { ...storage.profiles, [name]: next } });
        return buildAgentView(next, "profile", name, {
          profile: name,
          profiles: Object.keys(storage.profiles),
          workspaceFile,
        });
      }

      if (formatChoice !== undefined) patch.format = formatChoice as unknown as AgentConfig["format"];
      await saveAgentConfig(patch, storage.agentConfigPath);
      const saved = (await loadAgentConfig(storage.agentConfigPath)) ?? { baseURL: "", model: "", apiKey: "" };
      return buildAgentView(saved, "default", storage.agentConfigPath, { profiles, workspaceFile });
    },

    bindWorkspaceProfile: async (payload) => {
      const workspace = await get();
      const storage = await getStorage();
      const name = (payload?.profile ?? "").trim();
      const workspaceProfiles = { ...storage.workspaceProfiles };

      if (name === "" || name === "default") delete workspaceProfiles[workspace.root];
      else {
        if (!storage.profiles[name]) throw new Error(`没有名为「${name}」的配置档`);
        workspaceProfiles[workspace.root] = name;
      }

      await persist({ ...storage, workspaceProfiles });
      return { bound: workspaceProfiles[workspace.root] ?? "" };
    },

    deleteProfile: async (payload) => {
      const name = (payload?.profile ?? "").trim();
      const storage = await getStorage();
      if (!storage.profiles[name]) throw new Error(`没有名为「${name}」的配置档`);

      const profiles = { ...storage.profiles };
      delete profiles[name];
      const workspaceProfiles = { ...storage.workspaceProfiles };
      for (const [key, value] of Object.entries(workspaceProfiles)) {
        if (value === name) delete workspaceProfiles[key];
      }

      await persist({ ...storage, profiles, workspaceProfiles });
      return { ok: true };
    },

    opencodeAuth: async () => {
      const file = opencodeAuthFile(options.opencodeAuthPath);
      const modelsFile = opencodeModelsFile(options.opencodeModelsPath);
      let raw: Record<string, { key?: string } | undefined> = {};
      try {
        raw = JSON.parse(await readFile(file, "utf8")) as Record<string, { key?: string } | undefined>;
      } catch {
        return { file, modelsFile, available: [] };
      }

      const available: OpencodeAuthView["available"] = [];
      for (const entry of OPENCODE_PROVIDERS) {
        const key = raw[entry.id]?.key;
        if (typeof key !== "string" || key === "") continue;
        available.push({ ...entry, models: await readOpencodeModels(modelsFile, entry.id) });
      }
      return { file, modelsFile, available };
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

      const models = await readOpencodeModels(opencodeModelsFile(options.opencodeModelsPath), picked.id);
      const chosen = payload?.model !== undefined && payload.model !== "" ? payload.model : picked.model;
      const model = models.find((entry) => entry.id === chosen);
      const format = model?.format === "anthropic" ? "anthropic" : model?.format === "openai" ? "openai" : undefined;

      const configPath = (await getStorage()).agentConfigPath;
      await saveAgentConfig(
        { baseURL: picked.baseURL, model: chosen, apiKey: key, ...(format ? { format } : {}) },
        configPath,
      );
      return { ok: true, provider: picked.id, baseURL: picked.baseURL, model: chosen, format: format ?? "auto" };
    },

    storage: async () => ({ ...(await getStorage()), defaults }),

    saveStorage: async (payload) => {
      const agentConfigPath = typeof payload?.agentConfigPath === "string" ? payload.agentConfigPath.trim() : "";
      const historyDir = typeof payload?.historyDir === "string" ? payload.historyDir.trim() : "";
      if (agentConfigPath !== "") await assertWritableConfigFile(agentConfigPath);
      if (historyDir !== "") await assertWritableHistoryDir(historyDir);
      return { ...(await setStorage(payload ?? {})), defaults };
    },

    sessions: async () => {
      const target = await historyTarget();
      return listSessions(currentRoot, target.dir, target.label);
    },

    createSession: async (payload) => {
      const target = await historyTarget();
      return createSession(currentRoot, target.dir, payload?.title, target.label);
    },

    activateSession: async (payload) => {
      const target = await historyTarget();
      return activateSession(currentRoot, target.dir, payload.id, target.label);
    },

    renameSession: async (payload) => {
      if (typeof payload?.title !== "string" || payload.title.trim() === "") throw new Error("缺少 title");
      const target = await historyTarget();
      return renameSession(currentRoot, target.dir, payload.id, payload.title, target.label);
    },

    deleteSession: async (payload) => {
      const target = await historyTarget();
      return deleteSession(currentRoot, target.dir, payload.id, target.label);
    },

    history: async () => {
      const target = await historyTarget();
      return readActive(currentRoot, target.dir, target.label);
    },

    saveHistory: async (payload) => {
      const target = await historyTarget();
      await writeActive(currentRoot, target.dir, Array.isArray(payload?.messages) ? payload.messages : [], target.label);
      return { ok: true };
    },

    clearHistory: async () => {
      const target = await historyTarget();
      await writeActive(currentRoot, target.dir, [], target.label);
      return { ok: true };
    },

    plugins: async () => {
      const loaded = await pluginsPromise;
      return {
        plugins: loaded.plugins,
        commands: loaded.commands.map((command) => ({ id: command.id, title: command.title, hint: command.hint })),
      };
    },

    runPluginCommand: async (payload) => {
      const loaded = await pluginsPromise;
      const command = loaded.commands.find((entry) => entry.id === payload?.id);
      if (!command) throw new Error(`未知插件命令：${payload?.id ?? ""}`);
      return command.run({ root: currentRoot, pluginId: command.pluginId });
    },
  };

  const dispatch = async (method: string, payload?: unknown): Promise<unknown> => {
    const handler = (handlers as unknown as Record<string, ((input: unknown) => Promise<unknown>) | undefined>)[
      method
    ];
    if (typeof handler === "function") return handler.call(handlers, payload);

    const loaded = await pluginsPromise;
    const plugin = loaded.handlers[method];
    if (plugin) return plugin.run(payload, { root: currentRoot, pluginId: plugin.pluginId });
    throw new Error(`未知接口：${method}`);
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
    const { config } = await resolveAgent();
    const loaded = await pluginsPromise;
    const extraTools = loaded.tools.map((tool) => ({
      spec: tool.spec,
      run: (args: Record<string, unknown>) =>
        Promise.resolve(tool.run(args, { root: currentRoot, pluginId: tool.pluginId })),
    }));
    for await (const event of runAgent({ workspace, messages, config, signal, extraTools })) {
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
