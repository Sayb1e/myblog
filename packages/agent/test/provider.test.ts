import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { streamCompletion, streamCompletionAnthropic, type AssistantMessage } from "../src/provider.js";

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers) server.close();
  servers.length = 0;
});

function startServer(chunks: string[], status = 200): Promise<number> {
  const server = createServer((_request, response) => {
    response.writeHead(status, {
      "content-type": status === 200 ? "text/event-stream" : "application/json",
    });
    if (status === 200) {
      for (const chunk of chunks) response.write(chunk);
    } else {
      response.write(JSON.stringify({ error: "unauthorized" }));
    }
    response.end();
  });
  servers.push(server);
  server.listen(0);
  return new Promise((resolve) => {
    server.once("listening", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

function delta(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

interface Captured {
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

function startCapturing(chunks: string[]): Promise<{ port: number; captured: Captured }> {
  const captured: Captured = { url: "", headers: {}, body: {} };
  const server = createServer((request: IncomingMessage, response) => {
    let raw = "";
    request.on("data", (part) => {
      raw += part;
    });
    request.on("end", () => {
      captured.url = request.url ?? "";
      captured.headers = request.headers;
      captured.body = JSON.parse(raw || "{}") as Record<string, unknown>;
      response.writeHead(200, { "content-type": "text/event-stream" });
      for (const chunk of chunks) response.write(chunk);
      response.end();
    });
  });
  servers.push(server);
  server.listen(0);
  return new Promise((resolve) => {
    server.once("listening", () => {
      const address = server.address();
      resolve({ port: typeof address === "object" && address ? address.port : 0, captured });
    });
  });
}

describe("streamCompletion", () => {
  it("parses text and tool calls from an OpenAI-compatible stream", async () => {
    const port = await startServer([
      delta({ choices: [{ delta: { content: "你" } }] }),
      delta({ choices: [{ delta: { content: "好" } }] }),
      delta({
        choices: [
          {
            delta: {
              tool_calls: [
                { index: 0, id: "call_1", function: { name: "myblog_context", arguments: "{}" } },
              ],
            },
          },
        ],
      }),
      "data: [DONE]\n\n",
    ]);

    const config = { baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "test", model: "test" };
    let text = "";
    let message: AssistantMessage | null = null;

    for await (const event of streamCompletion(config, [{ role: "user", content: "hi" }], [])) {
      if (event.type === "text") text += event.text;
      else message = event.message;
    }

    expect(text).toBe("你好");
    expect(message?.tool_calls?.[0]?.function.name).toBe("myblog_context");
    expect(message?.tool_calls?.[0]?.id).toBe("call_1");
  });

  it("throws a readable error on a non-2xx response", async () => {
    const port = await startServer([], 401);
    const config = { baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "bad", model: "test" };

    await expect(
      (async () => {
        for await (const _event of streamCompletion(config, [], [])) {
          // drain
        }
      })(),
    ).rejects.toThrow(/401/);
  });
});

describe("streamCompletionAnthropic", () => {
  it("parses text and tool_use blocks from an Anthropic stream", async () => {
    const port = await startServer([
      delta({ type: "message_start", message: { id: "m1" } }),
      delta({ type: "content_block_start", index: 0, content_block: { type: "text" } }),
      delta({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "你" } }),
      delta({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "好" } }),
      delta({ type: "content_block_stop", index: 0 }),
      delta({
        type: "content_block_start",
        index: 1,
        content_block: { type: "tool_use", id: "toolu_1", name: "myblog_context" },
      }),
      delta({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"a"' } }),
      delta({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: ":1}" } }),
      delta({ type: "content_block_stop", index: 1 }),
      delta({ type: "message_stop" }),
    ]);

    const config = {
      baseURL: `http://127.0.0.1:${port}/v1`,
      apiKey: "test",
      model: "claude-x",
      format: "anthropic" as const,
    };
    let text = "";
    let message: AssistantMessage | null = null;

    for await (const event of streamCompletionAnthropic(config, [{ role: "user", content: "hi" }], [])) {
      if (event.type === "text") text += event.text;
      else message = event.message;
    }

    expect(text).toBe("你好");
    expect(message?.content).toBe("你好");
    expect(message?.tool_calls?.[0]).toMatchObject({
      id: "toolu_1",
      function: { name: "myblog_context", arguments: '{"a":1}' },
    });
  });

  it("sends the Anthropic request shape (system / tools / tool_result 合并)", async () => {
    const { port, captured } = await startCapturing([delta({ type: "message_stop" })]);

    const config = {
      baseURL: `http://127.0.0.1:${port}/v1`,
      apiKey: "secret",
      model: "claude-x",
      format: "anthropic" as const,
    };
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "fs_list",
          description: "列出目录",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
    ];

    for await (const _event of streamCompletionAnthropic(
      config,
      [
        { role: "system", content: "系统提示" },
        { role: "user", content: "看看目录" },
        {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "toolu_1", type: "function", function: { name: "fs_list", arguments: '{"path":"."}' } }],
        },
        { role: "tool", tool_call_id: "toolu_1", content: '{"path":".","entries":[]}' },
      ],
      tools,
    )) {
      // drain
    }

    expect(captured.url).toBe("/v1/messages");
    expect(captured.headers["x-api-key"]).toBe("secret");
    expect(captured.headers["anthropic-version"]).toBe("2023-06-01");
    expect(captured.body).toMatchObject({ model: "claude-x", max_tokens: 4096, stream: true, system: "系统提示" });

    const messages = captured.body.messages as { role: string; content: { type: string }[] }[];
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[1]?.content[0]).toMatchObject({ type: "tool_use", name: "fs_list" });
    expect(messages[2]?.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1" });

    const sentTools = captured.body.tools as { name: string; input_schema: unknown }[];
    expect(sentTools[0]?.name).toBe("fs_list");
    expect(sentTools[0]?.input_schema).toMatchObject({ type: "object" });
  });
});
