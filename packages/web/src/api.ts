import type {
  CheckResult,
  CloseDayInput,
  CloseDayResult,
  ProgressSnapshot,
  SummaryDoc,
  TodayPlan,
  WorkspaceStatus,
} from "@myblog/core";

const TOKEN_KEY = "myblog-token";

export interface StatusResponse extends WorkspaceStatus {
  root: string;
  version: string;
}

function tokenHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { "x-myblog-token": token } : {};
  } catch {
    return {};
  }
}

function withToken(init?: RequestInit): RequestInit {
  const headers = { ...(init?.headers as Record<string, string> | undefined), ...tokenHeaders() };
  return { ...init, headers };
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response = await fetch(input, withToken(init));
  if (response.status === 401) {
    const entered = window.prompt("本服务要求 token（远程模式）：");
    if (entered) {
      localStorage.setItem(TOKEN_KEY, entered);
      response = await fetch(input, withToken(init));
    }
  }
  return parse<T>(response);
}

function json(body: unknown): RequestInit {
  return { headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

export const getStatus = (): Promise<StatusResponse> => request("/api/status");
export const getToday = (): Promise<TodayPlan> => request("/api/today");
export const getCheck = (): Promise<CheckResult> => request("/api/check");
export const getSummaries = (): Promise<SummaryDoc[]> => request("/api/summaries");

export const getSummary = (date: string): Promise<{ exists: boolean; summary: SummaryDoc | null }> =>
  request(`/api/summaries/${date}`);

export const saveSummary = (date: string, content: string): Promise<{ ok: boolean; path: string }> =>
  request(`/api/summaries/${date}`, { method: "PUT", ...json({ content }) });

export const patchProgress = (patch: Partial<ProgressSnapshot>): Promise<{ ok: boolean; changed: boolean }> =>
  request("/api/progress", { method: "PATCH", ...json(patch) });

export const scaffoldDay = (date: string): Promise<{ created: boolean; path: string }> =>
  request("/api/scaffold", { method: "POST", ...json({ date }) });

export const closeDay = (payload: CloseDayInput & { dryRun?: boolean }): Promise<CloseDayResult> =>
  request("/api/close", { method: "POST", ...json(payload) });

export interface AgentConfigView {
  configured: boolean;
  baseURL: string;
  model: string;
  hasApiKey: boolean;
  configPath: string;
}

export const getAgentConfig = (): Promise<AgentConfigView> => request("/api/agent");

export const saveAgentConfig = (patch: { baseURL?: string; model?: string; apiKey?: string }): Promise<AgentConfigView> =>
  request("/api/agent", { method: "PUT", ...json(patch) });

export interface StorageView {
  agentConfigPath: string;
  historyDir: string;
  defaults: { agentConfigPath: string; historyDir: string };
}

export const getStorage = (): Promise<StorageView> => request("/api/storage");

export const saveStorage = (patch: { agentConfigPath?: string; historyDir?: string }): Promise<StorageView> =>
  request("/api/storage", { method: "PUT", ...json(patch) });

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; args: string }
  | { type: "tool"; name: string; args: string; result: unknown }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ChatToolRecord {
  name: string;
  args: string;
  result: unknown;
}

export interface ChatMessageRecord {
  id: number;
  role: "user" | "assistant";
  content: string;
  tools: ChatToolRecord[];
}

function trimHistory(messages: ChatMessageRecord[]): ChatMessageRecord[] {
  return messages.slice(-200).map((message) => ({
    ...message,
    tools: message.tools.map((tool) => {
      const serialized = JSON.stringify(tool.result);
      return serialized.length > 4000
        ? { ...tool, result: { note: "结果较大，已省略", preview: serialized.slice(0, 800) } }
        : tool;
    }),
  }));
}

export const getChatHistory = (): Promise<{ messages: ChatMessageRecord[] }> => request("/api/chat/history");

export const saveChatHistory = (messages: ChatMessageRecord[]): Promise<{ ok: boolean }> =>
  request("/api/chat/history", { method: "PUT", ...json({ messages: trimHistory(messages) }) });

export const clearChatHistory = (): Promise<{ ok: boolean }> =>
  request("/api/chat/history", { method: "DELETE" });

export async function streamChat(
  messages: { role: "user" | "assistant"; content: string }[],
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/chat", withToken({ method: "POST", ...json({ messages }), signal }));
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as ChatEvent);
      } catch {
        continue;
      }
    }
  }
}
