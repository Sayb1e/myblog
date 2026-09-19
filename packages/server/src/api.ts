import { readFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { runAgent, saveAgentConfig, viewAgentConfig } from "@myblog/agent";
import {
  Workspace,
  buildPlan,
  updateProgress,
  type CloseDayInput,
  type ProgressSnapshot,
  type ScaffoldOptions,
} from "@myblog/core";
import { createWorkspaceWatcher } from "./watcher.js";
import { defaultHistoryDir, readHistory, writeHistory, type StoredMessage } from "./history.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const require = createRequire(import.meta.url);
const VERSION = (require("../package.json") as { version?: string }).version ?? "0.0.0";

export interface ApiOptions {
  token?: string;
  agentConfigPath?: string;
  historyDir?: string;
}

export function createApi(root: string, options: ApiOptions = {}): Hono {
  const api = new Hono();
  const get = (): Promise<Workspace> => Workspace.load(root);
  const historyDir = options.historyDir ?? process.env.MYBLOG_HISTORY_DIR ?? defaultHistoryDir();

  if (options.token) {
    const token = options.token;
    api.use("*", async (c, next) => {
      const method = c.req.method.toUpperCase();
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
      const header = c.req.header("x-myblog-token") ?? c.req.header("authorization") ?? "";
      const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
      if (provided !== token) return c.json({ error: "需要有效的 MyBlog token" }, 401);
      return next();
    });
  }

  api.get("/status", async (c) => {
    const workspace = await get();
    const status = await workspace.readStatus();
    return c.json({ root: workspace.root, version: VERSION, ...status });
  });

  api.get("/check", async (c) => c.json(await (await get()).check()));

  api.get("/today", async (c) => {
    const workspace = await get();
    const status = await workspace.readStatus();
    const lastDate = status.records[0]?.date ?? "";
    let summary = null;
    if (lastDate) {
      try {
        summary = await workspace.readSummary(lastDate);
      } catch {
        summary = null;
      }
    }
    return c.json(buildPlan(status, summary));
  });

  api.get("/summaries", async (c) => {
    const workspace = await get();
    const entries = await readdir(workspace.root, { withFileTypes: true });
    const dates = entries
      .filter((entry) => entry.isDirectory() && DATE.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();

    const summaries = [];
    for (const date of dates) {
      try {
        summaries.push(await workspace.readSummary(date));
      } catch {
        continue;
      }
    }
    return c.json(summaries);
  });

  api.get("/summaries/:date", async (c) => {
    const date = c.req.param("date");
    if (!DATE.test(date)) return c.json({ error: "日期格式应为 YYYY-MM-DD" }, 400);
    const workspace = await get();
    try {
      return c.json({ exists: true, summary: await workspace.readSummary(date) });
    } catch {
      return c.json({ exists: false, summary: null });
    }
  });

  api.put("/summaries/:date", async (c) => {
    const date = c.req.param("date");
    if (!DATE.test(date)) return c.json({ error: "日期格式应为 YYYY-MM-DD" }, 400);
    const body = await c.req.json<{ content?: string }>();
    if (typeof body.content !== "string") return c.json({ error: "缺少 content" }, 400);

    const workspace = await get();
    await mkdir(workspace.dayDir(date), { recursive: true });
    await writeFile(workspace.summaryPath(date), body.content, "utf8");
    return c.json({ ok: true, path: workspace.summaryPath(date) });
  });

  api.patch("/progress", async (c) => {
    const body = await c.req.json<Partial<ProgressSnapshot>>();
    const patch: Partial<ProgressSnapshot> = {};
    if (body.learned !== undefined) patch.learned = body.learned;
    if (body.next !== undefined) patch.next = body.next;
    if (body.latest !== undefined) patch.latest = body.latest;

    const workspace = await get();
    const raw = await readFile(workspace.overviewPath, "utf8");
    const next = updateProgress(raw, patch);
    if (next !== raw) await writeFile(workspace.overviewPath, next, "utf8");
    return c.json({ ok: true, changed: next !== raw });
  });

  api.post("/scaffold", async (c) => {
    const body = await c.req.json<{ date?: string } & ScaffoldOptions>();
    if (!body.date || !DATE.test(body.date)) return c.json({ error: "日期格式应为 YYYY-MM-DD" }, 400);

    const scaffold: ScaffoldOptions = {};
    if (body.preview !== undefined) scaffold.preview = body.preview;
    if (body.next !== undefined) scaffold.next = body.next;
    if (body.skills !== undefined) scaffold.skills = body.skills;

    return c.json(await (await get()).scaffoldDay(body.date, scaffold));
  });

  api.post("/close", async (c) => {
    const body = await c.req.json<CloseDayInput & { dryRun?: boolean }>();
    if (!body.date || !DATE.test(body.date)) return c.json({ error: "日期格式应为 YYYY-MM-DD" }, 400);

    const input: CloseDayInput = { date: body.date };
    if (body.learned !== undefined) input.learned = body.learned;
    if (body.next !== undefined) input.next = body.next;
    if (body.didWhat !== undefined) input.didWhat = body.didWhat;
    if (body.link !== undefined) input.link = body.link;
    if (body.linkText !== undefined) input.linkText = body.linkText;
    if (body.latest !== undefined) input.latest = body.latest;

    return c.json(await (await get()).closeDay(input, { dryRun: body.dryRun }));
  });

  api.get("/agent", async (c) => c.json(await viewAgentConfig(options.agentConfigPath)));

  api.put("/agent", async (c) => {
    const body = await c.req.json<{ baseURL?: string; model?: string; apiKey?: string; temperature?: number }>();
    await saveAgentConfig(body, options.agentConfigPath);
    return c.json(await viewAgentConfig(options.agentConfigPath));
  });

  api.get("/chat/history", async (c) => c.json({ messages: await readHistory(root, historyDir) }));

  api.put("/chat/history", async (c) => {
    const body = await c.req.json<{ messages?: StoredMessage[] }>();
    await writeHistory(root, historyDir, Array.isArray(body.messages) ? body.messages : []);
    return c.json({ ok: true });
  });

  api.delete("/chat/history", async (c) => {
    await writeHistory(root, historyDir, []);
    return c.json({ ok: true });
  });

  api.post("/chat", async (c) => {
    const body = await c.req.json<{ messages?: { role?: string; content?: string }[] }>();
    const messages = (body.messages ?? [])
      .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content ?? "" }));

    const workspace = await get();
    return streamSSE(c, async (stream) => {
      const abort = new AbortController();
      stream.onAbort(() => abort.abort());

      for await (const event of runAgent({
        workspace,
        messages,
        configPath: options.agentConfigPath,
        signal: abort.signal,
      })) {
        if (abort.signal.aborted) break;
        try {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        } catch {
          break;
        }
      }
    });
  });

  api.get("/events", (c) =>
    streamSSE(c, async (stream) => {
      let open = true;
      const dispose = createWorkspaceWatcher(root, () => {
        void stream.writeSSE({ event: "change", data: String(Date.now()) });
      });

      stream.onAbort(() => {
        open = false;
        dispose();
      });

      await stream.writeSSE({ event: "ready", data: "ok" });
      while (open) {
        await stream.sleep(15000);
        if (open) await stream.writeSSE({ event: "ping", data: "1" });
      }
    }),
  );

  return api;
}
