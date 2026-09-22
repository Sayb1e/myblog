import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultAgentConfigPath } from "@myblog/agent";
import { defaultHistoryDir } from "./history.js";

export interface AgentProfile {
  baseURL: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  format?: "openai" | "anthropic";
  maxTokens?: number;
}

export interface StorageSettings {
  agentConfigPath: string;
  historyDir: string;
  workspaces: string[];
  activeWorkspace: string;
  /** 工作区别名（路径 -> 显示名） */
  names: Record<string, string>;
  /** 命名配置档（名字 -> 模型配置） */
  profiles: Record<string, AgentProfile>;
  /** 工作区绑定哪个配置档（路径 -> 档案名；空 = 用默认） */
  workspaceProfiles: Record<string, string>;
}

export function defaultStorageSettings(root: string): StorageSettings {
  return {
    agentConfigPath: defaultAgentConfigPath(),
    historyDir: defaultHistoryDir(),
    workspaces: [root],
    activeWorkspace: root,
    names: {},
    profiles: {},
    workspaceProfiles: {},
  };
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function asNames(value: unknown): Record<string, string> {
  const names: Record<string, string> = {};
  if (!value || typeof value !== "object") return names;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry.trim() !== "") names[key] = entry.trim();
  }
  return names;
}

function asProfiles(value: unknown): Record<string, AgentProfile> {
  const profiles: Record<string, AgentProfile> = {};
  if (!value || typeof value !== "object") return profiles;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Partial<AgentProfile>;
    if (typeof raw.baseURL !== "string" || typeof raw.model !== "string") continue;
    if (raw.baseURL === "" || raw.model === "") continue;
    const profile: AgentProfile = { baseURL: raw.baseURL, model: raw.model };
    if (typeof raw.apiKey === "string" && raw.apiKey !== "") profile.apiKey = raw.apiKey;
    if (typeof raw.temperature === "number") profile.temperature = raw.temperature;
    if (raw.format === "openai" || raw.format === "anthropic") profile.format = raw.format;
    if (typeof raw.maxTokens === "number") profile.maxTokens = raw.maxTokens;
    profiles[key] = profile;
  }
  return profiles;
}

function asWorkspaceProfiles(value: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!value || typeof value !== "object") return map;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry.trim() !== "") map[key] = entry.trim();
  }
  return map;
}

export async function readStorage(file: string, defaults: StorageSettings): Promise<StorageSettings> {
  let raw: Partial<StorageSettings> = {};
  try {
    raw = JSON.parse(await readFile(file, "utf8")) as Partial<StorageSettings>;
  } catch {
    return defaults;
  }
  const workspaces = Array.isArray(raw.workspaces)
    ? raw.workspaces.filter((entry): entry is string => typeof entry === "string" && entry !== "")
    : defaults.workspaces;
  const merged = new Set<string>();
  for (const entry of defaults.workspaces) merged.add(entry);
  for (const entry of workspaces) merged.add(entry);
  merged.add(defaults.activeWorkspace);
  const list = [...merged];
  const active = asString(raw.activeWorkspace, defaults.activeWorkspace);
  return {
    agentConfigPath: asString(raw.agentConfigPath, defaults.agentConfigPath),
    historyDir: asString(raw.historyDir, defaults.historyDir),
    workspaces: list.includes(active) ? list : [...list, active],
    activeWorkspace: active,
    names: asNames(raw.names),
    profiles: asProfiles(raw.profiles),
    workspaceProfiles: asWorkspaceProfiles(raw.workspaceProfiles),
  };
}

export async function writeStorage(file: string, settings: StorageSettings): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
