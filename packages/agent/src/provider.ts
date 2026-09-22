import { randomUUID } from "node:crypto";
import type { AgentConfig } from "./config.js";

/** OpenCode Go/Zen 网关要求带 session 头才能路由（第三方客户端也一样） */
function opencodeHeaders(baseURL: string): Record<string, string> {
  try {
    return new URL(baseURL).hostname.endsWith("opencode.ai") ? { "x-opencode-session": randomUUID() } : {};
  } catch {
    return {};
  }
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ProviderEvent = { type: "text"; text: string } | { type: "message"; message: AssistantMessage };

interface DeltaToolCallPart {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface StreamChunk {
  choices?: {
    delta?: {
      content?: string;
      tool_calls?: DeltaToolCallPart[];
    };
  }[];
}

export async function* streamCompletion(
  config: AgentConfig,
  messages: ChatMessage[],
  tools: ToolSpec[],
  signal?: AbortSignal,
): AsyncGenerator<ProviderEvent> {
  const endpoint = `${config.baseURL.replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
      ...opencodeHeaders(config.baseURL),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
      temperature: config.temperature,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`模型接口返回 ${response.status}：${detail.slice(0, 500) || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const calls = new Map<number, { id: string; name: string; args: string }>();
  let buffer = "";
  let content = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;

      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload) as StreamChunk;
      } catch {
        continue;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        content += delta.content;
        yield { type: "text", text: delta.content };
      }

      for (const part of delta.tool_calls ?? []) {
        const index = part.index ?? 0;
        const entry = calls.get(index) ?? { id: "", name: "", args: "" };
        if (part.id) entry.id = part.id;
        if (part.function?.name) entry.name = part.function.name;
        if (part.function?.arguments) entry.args += part.function.arguments;
        calls.set(index, entry);
      }
    }
  }

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort((left, right) => left[0] - right[0])
    .filter(([, entry]) => entry.name !== "")
    .map(([index, entry]) => ({
      id: entry.id || `call_${index}`,
      type: "function",
      function: { name: entry.name, arguments: entry.args || "{}" },
    }));

  const message: AssistantMessage = { role: "assistant", content };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;
  yield { type: "message", message };
}

// ---------- Anthropic Messages API（Claude / Zen 上需要 anthropic 格式的模型） ----------

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
}

interface AnthropicStreamEvent {
  type?: string;
  index?: number;
  content_block?: AnthropicBlock;
  delta?: { type?: string; text?: string; partial_json?: string };
  message?: { stop_reason?: string };
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toAnthropicMessages(messages: ChatMessage[]): { system: string; messages: unknown[] } {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content ?? "")
    .filter((text) => text !== "")
    .join("\n\n");

  const converted: { role: "user" | "assistant"; content: AnthropicBlock[] }[] = [];

  const push = (role: "user" | "assistant", blocks: AnthropicBlock[]): void => {
    const last = converted[converted.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else converted.push({ role, content: blocks });
  };

  for (const message of messages) {
    if (message.role === "system") continue;

    if (message.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: message.tool_call_id ?? "", content: message.content ?? "" }]);
      continue;
    }

    if (message.role === "assistant") {
      const blocks: AnthropicBlock[] = [];
      if (message.content) blocks.push({ type: "text", text: message.content });
      for (const call of message.tool_calls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.function.name, input: parseArgs(call.function.arguments) });
      }
      push("assistant", blocks.length > 0 ? blocks : [{ type: "text", text: "" }]);
      continue;
    }

    push("user", [{ type: "text", text: message.content ?? "" }]);
  }

  return { system, messages: converted };
}

export async function* streamCompletionAnthropic(
  config: AgentConfig,
  messages: ChatMessage[],
  tools: ToolSpec[],
  signal?: AbortSignal,
): AsyncGenerator<ProviderEvent> {
  const endpoint = `${config.baseURL.replace(/\/+$/, "")}/messages`;
  const { system, messages: payloadMessages } = toAnthropicMessages(messages);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      ...opencodeHeaders(config.baseURL),
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
      ...(system !== "" ? { system } : {}),
      messages: payloadMessages,
      ...(tools.length > 0
        ? {
            tools: tools.map((tool) => ({
              name: tool.function.name,
              description: tool.function.description,
              input_schema: tool.function.parameters,
            })),
          }
        : {}),
      stream: true,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`模型接口返回 ${response.status}：${detail.slice(0, 500) || response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const blocks = new Map<number, { id: string; name: string; args: string }>();
  let buffer = "";
  let content = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");

      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;

      let event: AnthropicStreamEvent;
      try {
        event = JSON.parse(payload) as AnthropicStreamEvent;
      } catch {
        continue;
      }

      if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
        const index = event.index ?? blocks.size;
        blocks.set(index, { id: event.content_block.id ?? `tool_${index}`, name: event.content_block.name ?? "", args: "" });
        continue;
      }

      if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta?.type === "text_delta" && delta.text) {
          content += delta.text;
          yield { type: "text", text: delta.text };
        } else if (delta?.type === "input_json_delta" && delta.partial_json) {
          const index = event.index ?? 0;
          const entry = blocks.get(index) ?? { id: `tool_${index}`, name: "", args: "" };
          entry.args += delta.partial_json;
          blocks.set(index, entry);
        }
        continue;
      }

      if (event.type === "error") {
        throw new Error(`模型接口返回错误：${payload.slice(0, 300)}`);
      }
    }
  }

  const toolCalls: ToolCall[] = [...blocks.entries()]
    .sort((left, right) => left[0] - right[0])
    .filter(([, entry]) => entry.name !== "")
    .map(([index, entry]) => ({
      id: entry.id || `call_${index}`,
      type: "function",
      function: { name: entry.name, arguments: entry.args || "{}" },
    }));

  const message: AssistantMessage = { role: "assistant", content };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;
  yield { type: "message", message };
}
