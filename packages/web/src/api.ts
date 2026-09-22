import type {
  CheckResult,
  CloseDayInput,
  CloseDayResult,
  ProgressSnapshot,
  SummaryDoc,
  TodayPlan,
} from "@myblog/core";
import type {
  AgentConfigView,
  AgentEvent,
  ApiMethod,
  ApiPayload,
  ApiResult,
  ChatStreamPayload,
  FileContent,
  FileListing,
  GitState,
  OpencodeAuthView,
  SearchHit,
  SessionList,
  SessionMeta,
  StatusResponse,
  StorageView,
  StoredMessage,
} from "@myblog/server";

export type {
  AgentConfigView,
  AgentEvent as ChatEvent,
  FileContent,
  FileEntry,
  FileListing,
  GitState,
  OpencodeAuthView,
  SearchHit,
  SessionList,
  SessionMeta,
  StatusResponse,
  StorageView,
  StoredMessage as ChatMessageRecord,
  StoredTool as ChatToolRecord,
} from "@myblog/server";

export interface WorkspaceList {
  active: string;
  list: string[];
}

function bridge(): MyBlogApiBridge {
  const api = window.myblog?.api;
  if (!api) throw new Error("MyBlog 需要在桌面端内运行");
  return api;
}

function call<M extends ApiMethod>(method: M, payload?: ApiPayload<M>): Promise<ApiResult<M>> {
  return bridge().invoke(method, payload) as Promise<ApiResult<M>>;
}

export function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

export const getStatus = (): Promise<StatusResponse> => call("status");
export const getToday = (): Promise<TodayPlan> => call("today");
export const getCheck = (): Promise<CheckResult> => call("check");
export const getSummaries = (): Promise<SummaryDoc[]> => call("summaries");

export const getSummary = (date: string): Promise<{ exists: boolean; summary: SummaryDoc | null }> =>
  call("summary", { date });

export const saveSummary = (date: string, content: string): Promise<{ ok: boolean; path: string }> =>
  call("saveSummary", { date, content });

export const patchProgress = (patch: Partial<ProgressSnapshot>): Promise<{ ok: boolean; changed: boolean }> =>
  call("patchProgress", patch);

export const scaffoldDay = (date: string): Promise<{ created: boolean; path: string }> => call("scaffold", { date });

export const closeDay = (payload: CloseDayInput & { dryRun?: boolean }): Promise<CloseDayResult> =>
  call("close", payload);

export const getAgentConfig = (): Promise<AgentConfigView> => call("agent");

export const saveAgentConfig = (patch: {
  baseURL?: string;
  model?: string;
  apiKey?: string;
}): Promise<AgentConfigView> => call("saveAgent", patch);

export const getStorage = (): Promise<StorageView> => call("storage");

export const saveStorage = (patch: {
  agentConfigPath?: string;
  historyDir?: string;
}): Promise<StorageView> => call("saveStorage", patch);

export const getWorkspaces = (): Promise<WorkspaceList> => call("workspaces");

export const switchWorkspace = (path: string): Promise<WorkspaceList> => call("setWorkspace", { path });

export const addWorkspace = (path: string): Promise<WorkspaceList> => call("addWorkspace", { path });

export const initWorkspace = (): Promise<{ created: string[] }> => call("init");

export const getOpencodeAuth = (): Promise<OpencodeAuthView> => call("opencodeAuth");

export const importOpencode = (
  provider?: string,
): Promise<{ ok: boolean; provider: string; baseURL: string; model: string }> =>
  call("importOpencode", provider === undefined ? undefined : { provider });

export const listFiles = (path?: string): Promise<FileListing> =>
  call("files", path === undefined || path === "" ? undefined : { path });

export const readWorkspaceFile = (path: string): Promise<FileContent> => call("readFile", { path });

export const searchWorkspace = (query: string, limit?: number): Promise<{ query: string; hits: SearchHit[] }> =>
  call("search", limit === undefined ? { query } : { query, limit });

export const setCapabilityStatus = (id: string, status: string): Promise<{ ok: boolean; changed: boolean }> =>
  call("setCapability", { id, status });

export const getGit = (): Promise<GitState> => call("git");

export const commitGit = (message: string): Promise<{ ok: boolean; output: string }> => call("gitCommit", { message });

export const getSessions = (): Promise<SessionList> => call("sessions");

export const createSession = (title?: string): Promise<SessionList & { session: SessionMeta }> =>
  call("createSession", title === undefined ? undefined : { title });

export const activateSession = (id: string): Promise<SessionList> => call("activateSession", { id });

export const renameSession = (id: string, title: string): Promise<SessionList> =>
  call("renameSession", { id, title });

export const deleteSession = (id: string): Promise<SessionList> => call("deleteSession", { id });

export const getChatHistory = (): Promise<{ session: SessionMeta | null; messages: StoredMessage[] }> =>
  call("history");

export const saveChatHistory = (messages: StoredMessage[]): Promise<{ ok: boolean }> =>
  call("saveHistory", { messages: trimHistory(messages) });

export const clearChatHistory = (): Promise<{ ok: boolean }> => call("clearHistory");

function trimHistory(messages: StoredMessage[]): StoredMessage[] {
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

export async function streamChat(
  messages: ChatStreamPayload["messages"],
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const api = bridge();
  const streamId = `s${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const off = api.onChatEvent((payload) => {
    if (payload.streamId !== streamId) return;
    onEvent(payload.event);
  });
  const cancel = (): void => api.cancelChat(streamId);
  signal?.addEventListener("abort", cancel);

  try {
    await api.chat({ streamId, messages });
  } finally {
    signal?.removeEventListener("abort", cancel);
    off();
  }
}
