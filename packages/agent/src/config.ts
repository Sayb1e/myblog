import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export interface AgentConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

export interface AgentConfigView {
  configured: boolean;
  baseURL: string;
  model: string;
  hasApiKey: boolean;
  configPath: string;
}

export function defaultAgentConfigPath(): string {
  return path.join(homedir(), ".myblog", "agent.json");
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
  if (baseURL && model) return { baseURL, apiKey, model };
  return null;
}

export async function loadAgentConfig(configPath = defaultAgentConfigPath()): Promise<AgentConfig | null> {
  const env = fromEnv();
  if (env) return env;

  const stored = await readRaw(configPath);
  if (stored.baseURL && stored.model) {
    return {
      baseURL: stored.baseURL,
      model: stored.model,
      apiKey: stored.apiKey ?? "",
      temperature: stored.temperature,
    };
  }
  return null;
}

export async function saveAgentConfig(
  patch: Partial<AgentConfig>,
  configPath = defaultAgentConfigPath(),
): Promise<void> {
  const stored = await readRaw(configPath);
  const next: AgentConfig = {
    baseURL: patch.baseURL ?? stored.baseURL ?? "",
    model: patch.model ?? stored.model ?? "",
    apiKey: patch.apiKey !== undefined && patch.apiKey !== "" ? patch.apiKey : stored.apiKey ?? "",
    temperature: patch.temperature ?? stored.temperature,
  };

  await mkdir(path.dirname(configPath), { recursive: true });
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
  };
}
