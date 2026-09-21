import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultAgentConfigPath } from "@myblog/agent";
import { defaultHistoryDir } from "./history.js";

export interface StorageSettings {
  agentConfigPath: string;
  historyDir: string;
  workspaces: string[];
  activeWorkspace: string;
}

export function defaultStorageSettings(root: string): StorageSettings {
  return {
    agentConfigPath: defaultAgentConfigPath(),
    historyDir: defaultHistoryDir(),
    workspaces: [root],
    activeWorkspace: root,
  };
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
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
  };
}

export async function writeStorage(file: string, settings: StorageSettings): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
