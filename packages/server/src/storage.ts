import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultAgentConfigPath } from "@myblog/agent";
import { defaultHistoryDir } from "./history.js";

export interface StorageSettings {
  agentConfigPath: string;
  historyDir: string;
}

export function defaultStorageSettings(): StorageSettings {
  return {
    agentConfigPath: defaultAgentConfigPath(),
    historyDir: defaultHistoryDir(),
  };
}

export async function readStorage(file: string, defaults: StorageSettings): Promise<StorageSettings> {
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as Partial<StorageSettings>;
    return {
      agentConfigPath:
        typeof raw.agentConfigPath === "string" && raw.agentConfigPath !== ""
          ? raw.agentConfigPath
          : defaults.agentConfigPath,
      historyDir:
        typeof raw.historyDir === "string" && raw.historyDir !== "" ? raw.historyDir : defaults.historyDir,
    };
  } catch {
    return defaults;
  }
}

export async function writeStorage(file: string, settings: StorageSettings): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
