import { buildContext, type Workspace } from "@myblog/core";
import { loadAgentConfig } from "./config.js";
import {
  streamCompletion,
  type AssistantMessage,
  type ChatMessage,
  type ToolSpec,
} from "./provider.js";
import { executeTool, toolSpecs } from "./tools.js";

const SYSTEM_PROMPT = `你是 MyBlog 的学习助手，管理一个基于 markdown 的学习工作区（学习进度总览 / 岗位目标 / 每日总结）。

规则：
1. 用中文回答，简洁、可执行。
2. 规划当天任务时，把「下次从哪继续」与当前阶段 G 能力取交集，给出 1-3 条具体动作，每条附验证方式；不要提前开后面的阶段。
3. 当前工作区上下文已直接给你（系统消息里的 JSON）。除非确需某天历史总结（myblog_read_summary）、用户明确要求校验（myblog_check），否则不要重复调用 myblog_context / myblog_check，避免无谓的工具调用。
4. 任何写操作都要先征得用户同意：先用 myblog_close（默认 dryRun=true）或 myblog_scaffold，把 diff / 结果给用户看；用户明确同意后才用 dryRun:false 落盘。
5. 只改动与今天相关的内容，外科手术式写回，不要整篇重写。`;

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentRunOptions {
  workspace: Workspace;
  messages: AgentMessage[];
  configPath?: string;
  signal?: AbortSignal;
  maxSteps?: number;
}

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; args: string }
  | { type: "tool"; name: string; args: string; result: unknown }
  | { type: "error"; message: string }
  | { type: "done" };

export async function* runAgent(options: AgentRunOptions): AsyncGenerator<AgentEvent> {
  const config = await loadAgentConfig(options.configPath);
  if (!config) {
    yield { type: "error", message: "还没有配置模型：请在设置里填 baseURL / apiKey / model。" };
    yield { type: "done" };
    return;
  }

  const context = await buildContext(options.workspace);
  const history: ChatMessage[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n当前工作区上下文（JSON）：\n${JSON.stringify(context, null, 2)}` },
    ...options.messages.map((message) => ({ role: message.role, content: message.content })),
  ];

  const tools: ToolSpec[] = toolSpecs();
  const maxSteps = options.maxSteps ?? 6;

  try {
    for (let step = 0; step < maxSteps; step += 1) {
      let assistant: AssistantMessage | null = null;
      for await (const event of streamCompletion(config, history, tools, options.signal)) {
        if (event.type === "text") yield { type: "text", text: event.text };
        else assistant = event.message;
      }
      if (!assistant) break;

      history.push(assistant);
      if (!assistant.tool_calls || assistant.tool_calls.length === 0) break;

      for (const call of assistant.tool_calls) {
        yield { type: "tool_start", name: call.function.name, args: call.function.arguments };
        let result: unknown;
        try {
          const parsed = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          result = await executeTool(options.workspace, call.function.name, parsed);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : String(error) };
        }
        history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        yield { type: "tool", name: call.function.name, args: call.function.arguments, result };
      }
    }
  } catch (error) {
    yield { type: "error", message: error instanceof Error ? error.message : String(error) };
  }

  yield { type: "done" };
}
