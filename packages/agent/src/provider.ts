import type { AgentConfig } from "./config.js";

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
