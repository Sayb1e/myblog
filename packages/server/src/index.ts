import { Workspace } from "@myblog/core";

export { createApi } from "./handlers.js";
export { createWorkspaceWatcher } from "./watcher.js";

/** 在指定目录生成最小学习库结构（PROGRESS.md / GOALS.md），给首启向导/示例用 */
export async function scaffoldWorkspace(root: string): Promise<{ created: string[] }> {
  return (await Workspace.load(root)).initWorkspace();
}
export type {
  AgentView,
  ApiMethod,
  ApiOptions,
  ApiPayload,
  ApiResult,
  ChatStreamPayload,
  FileContent,
  FileEntry,
  FileListing,
  GitState,
  MyBlogApi,
  MyBlogHandlers,
  OpencodeAuthView,
  OpencodeModel,
  SearchHit,
  SessionList,
  StatusResponse,
  StorageView,
  WorkspaceList,
} from "./handlers.js";
export type { AgentProfile } from "./storage.js";
export type { PluginInfo, PluginManifest } from "./plugins.js";
export type { AgentEvent, AgentConfigView, GoalsDraftResult, GoalsValidation } from "@myblog/agent";
export type { SessionMeta, StoredMessage, StoredTool } from "./history.js";
