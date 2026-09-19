import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { streamCompletion, type AssistantMessage } from "../src/provider.js";

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
