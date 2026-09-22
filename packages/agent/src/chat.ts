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
2. **默认就是普通对话**：直接回答用户的问题，像正常聊天一样。只有用户的请求确实需要动工作区时，才调用工具；不要为了“把工作区补全”“顺手记录一下”而主动调用任何工具。
   - 闲聊、提问、问概念、让你解释代码、让你给建议 → **不调用工具**，直接回答。
   - 只有当用户明确要求「读某个文件 / 写或改某个文件 / 记录今天进度 / 生成总结 / 校验工作区」时，才调用对应工具。
   - 不要每次回复都追加「需要我写入吗」「要我保存吗」这类问句；只有当你**确实准备落盘**、需要用户点一次确认时才问。
3. 规划当天任务时，把「下次从哪继续」与当前阶段 G 能力取交集，给出 1-3 条具体动作，每条附验证方式；不要提前开后面的阶段。
4. 当前工作区上下文已直接给你（系统消息里的 JSON）。除非确需某天历史总结（myblog_read_summary）、用户明确要求校验（myblog_check），否则不要重复调用 myblog_context / myblog_check。
5. 写操作要先征得用户同意：用 myblog_close（默认 dryRun=true）或 myblog_scaffold，把 diff / 结果给用户看；用户明确同意后才用 dryRun:false 落盘。
6. 读写工作区里的普通文件（脚本、代码、笔记等）用 fs_list / fs_read / fs_write，路径一律用相对工作区根目录的相对路径。同样先以 fs_write（默认 dryRun=true）出 diff，用户同意后才传 dryRun:false；不要声称自己没有写文件权限。用户只是让你给出文件内容时，把内容写在回复里即可，不要调用 fs_write。
7. 只改动与今天相关的内容，外科手术式写回，不要整篇重写。`;

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
