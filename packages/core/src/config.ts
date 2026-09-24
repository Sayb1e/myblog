import { readFile } from "node:fs/promises";
import path from "node:path";

export interface WorkspaceConfig {
  root: string;
  overview: string;
  goals: string;
  dailyDirPattern: "YYYY-MM-DD";
  summaryFile: string;
  skillPrefix: string;
  configFile: string;
}

export const DEFAULT_CONFIG: Omit<WorkspaceConfig, "root"> = {
  overview: "PROGRESS.md",
  goals: "GOALS.md",
  dailyDirPattern: "YYYY-MM-DD",
  summaryFile: "SUMMARY.md",
  skillPrefix: "G",
  configFile: "myblog.config.json",
};

/** 每日总结的旧默认文件名，读取/迁移时兼容 */
export const LEGACY_SUMMARY_FILE = "总结.md";

export async function loadConfig(root: string, override: Partial<WorkspaceConfig> = {}): Promise<WorkspaceConfig> {
  const absoluteRoot = path.resolve(root);
  let fromDisk: Partial<WorkspaceConfig> = {};
  try {
    const raw = await readFile(path.join(absoluteRoot, DEFAULT_CONFIG.configFile), "utf8");
    fromDisk = JSON.parse(raw) as Partial<WorkspaceConfig>;
  } catch {
    fromDisk = {};
  }

  return {
    ...DEFAULT_CONFIG,
    ...fromDisk,
    ...override,
    root: absoluteRoot,
    configFile: DEFAULT_CONFIG.configFile,
  };
}
