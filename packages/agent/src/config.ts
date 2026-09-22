import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type AgentFormat = "openai" | "anthropic";

export interface AgentConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  /** 接口格式；不填按 baseURL / model 推断 */
  format?: AgentFormat;
  /** Anthropic 格式必填，默认 4096 */
  maxTokens?: number;
}

export interface AgentConfigView {
  configured: boolean;
  baseURL: string;
  model: string;
  hasApiKey: boolean;
  configPath: string;
  format: AgentFormat;
  maxTokens: number;
}

export const DEFAULT_MAX_TOKENS = 4096;

export function defaultAgentConfigPath(): string {
  return path.join(homedir(), ".myblog", "agent.json");
}

/** 推断接口格式：显式配置优先，其次看 baseURL / 模型名 */
export function inferFormat(config: { baseURL?: string; model?: string; format?: AgentFormat }): AgentFormat {
  if (config.format === "openai" || config.format === "anthropic") return config.format;
  const base = (config.baseURL ?? "").toLowerCase();
  const model = config.model ?? "";
  if (base.includes("anthropic")) return "anthropic";
  if (/^claude/i.test(model)) return "anthropic";
  return "openai";
}

function asFormat(value: unknown): AgentFormat | undefined {
  return value === "openai" || value === "anthropic" ? value : undefined;
}

/** 建目录；已存在（含盘符根目录这种 mkdir 会 EPERM 的情况）直接跳过 */
async function ensureDir(dir: string): Promise<void> {
  if (dir === "" || dir === ".") return;
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM" || code === "EACCES" || code === "EEXIST") return;
    throw error;
  }
}

async function readRaw(configPath: string): Promise<Partial<AgentConfig>> {
  try {
    return JSON.parse(await readFile(configPath, "utf8")) as Partial<AgentConfig>;
  } catch {
    return {};
  }
}

function fromEnv(): AgentConfig | null {
  const baseURL = process.env.MYBLOG_AGENT_BASE_URL;
  const model = process.env.MYBLOG_AGENT_MODEL;
  const apiKey = process.env.MYBLOG_AGENT_API_KEY ?? "";
  if (baseURL && model) return { baseURL, apiKey, model, format: asFormat(process.env.MYBLOG_AGENT_FORMAT) };
  return null;
}

export async function loadAgentConfig(configPath = defaultAgentConfigPath()): Promise<AgentConfig | null> {
  const env = fromEnv();
  if (env) return env;

  const stored = await readRaw(configPath);
  if (stored.baseURL && stored.model) {
    const config: AgentConfig = {
      baseURL: stored.baseURL,
      model: stored.model,
      apiKey: stored.apiKey ?? "",
    };
    if (stored.temperature !== undefined) config.temperature = stored.temperature;
    const format = asFormat(stored.format);
    if (format !== undefined) config.format = format;
    if (typeof stored.maxTokens === "number") config.maxTokens = stored.maxTokens;
    return config;
  }
  return null;
}

export async function saveAgentConfig(
  patch: Partial<AgentConfig>,
  configPath = defaultAgentConfigPath(),
): Promise<void> {
  const stored = await readRaw(configPath);
  const wantsAuto = (patch.format as unknown) === "auto";
  const format = wantsAuto ? undefined : (asFormat(patch.format) ?? asFormat(stored.format));
  const next: AgentConfig = {
    baseURL: patch.baseURL ?? stored.baseURL ?? "",
    model: patch.model ?? stored.model ?? "",
    apiKey: patch.apiKey !== undefined && patch.apiKey !== "" ? patch.apiKey : stored.apiKey ?? "",
    temperature: patch.temperature ?? stored.temperature,
  };
  if (format !== undefined) next.format = format;
  if (patch.maxTokens ?? stored.maxTokens) next.maxTokens = patch.maxTokens ?? stored.maxTokens;

  await ensureDir(path.dirname(configPath));
  await writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function viewAgentConfig(configPath = defaultAgentConfigPath()): Promise<AgentConfigView> {
  const config = await loadAgentConfig(configPath);
  const stored = await readRaw(configPath);
  return {
    configured: config !== null,
    baseURL: config?.baseURL ?? "",
    model: config?.model ?? "",
    hasApiKey: Boolean(config?.apiKey ?? stored.apiKey),
    configPath,
    format: inferFormat(config ?? {}),
    maxTokens: config?.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}
