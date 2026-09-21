import { readFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { runAgent, saveAgentConfig, viewAgentConfig } from "@myblog/agent";
import {
  Workspace,
  buildPlan,
  emptyStatus,
  updateProgress,
  type CloseDayInput,
  type ProgressSnapshot,
  type ScaffoldOptions,
} from "@myblog/core";
import { createWorkspaceWatcher } from "./watcher.js";
import {
  activateSession,
  createSession,
  deleteSession,
  listSessions,
  readActive,
  renameSession,
  writeActive,
  type StoredMessage,
} from "./history.js";
import { defaultStorageSettings, readStorage, writeStorage, type StorageSettings } from "./storage.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const require = createRequire(import.meta.url);
const VERSION = (require("../package.json") as { version?: string }).version ?? "0.0.0";

export interface ApiOptions {
  token?: string;
  agentConfigPath?: string;
  historyDir?: string;
  workspaces?: string[];
}

export function createApi(root: string, options: ApiOptions = {}): Hono {
  const api = new Hono();

  const defaults: StorageSettings = defaultStorageSettings(path.resolve(root));
  if (options.agentConfigPath) defaults.agentConfigPath = options.agentConfigPath;
  if (options.historyDir) defaults.historyDir = options.historyDir;
  else if (process.env.MYBLOG_HISTORY_DIR) defaults.historyDir = process.env.MYBLOG_HISTORY_DIR;
  if (options.workspaces) {
    defaults.workspaces = [
      ...new Set([path.resolve(root), ...options.workspaces.map((entry) => path.resolve(entry))]),
    ];
  }
  const storageFile = path.join(path.dirname(defaults.agentConfigPath), "settings.json");

  let storage: StorageSettings | null = null;
  let currentRoot = defaults.activeWorkspace;

  const getStorage = async (): Promise<StorageSettings> => {
    if (!storage) {
      storage = await readStorage(storageFile, defaults);
      currentRoot = storage.activeWorkspace;
    }
    return storage;
  };
  const persist = async (next: StorageSettings): Promise<void> => {
    await writeStorage(storageFile, next);
    storage = next;
    currentRoot = next.activeWorkspace;
  };
  const get = async (): Promise<Workspace> => {
    await getStorage();
    return Workspace.load(currentRoot);
  };
  const setStorage = async (patch: Partial<StorageSettings>): Promise<StorageSettings> => {
    const current = await getStorage();
    const next: StorageSettings = {
      agentConfigPath:
        typeof patch.agentConfigPath === "string" && patch.agentConfigPath !== ""
          ? path.resolve(patch.agentConfigPath)
          : current.agentConfigPath,
      historyDir:
        typeof patch.historyDir === "string" && patch.historyDir !== ""
          ? path.resolve(patch.historyDir)
          : current.historyDir,
      workspaces: current.workspaces,
      activeWorkspace: current.activeWorkspace,
    };
    await persist(next);
    return next;
  };

  if (options.token) {
    const token = options.token;
    api.use("*", async (c, next) => {
      const method = c.req.method.toUpperCase();
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
      const header = c.req.header("x-myblog-token") ?? c.req.header("authorization") ?? "";
      const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
      if (provided !== token) return c.json({ error: "闇€瑕佹湁鏁堢殑 MyBlog token" }, 401);
      return next();
    });
  }

  api.get("/status", async (c) => {
    const workspace = await get();
    const { initialized, status } = await workspace.readStatusSafe();
    return c.json({ root: workspace.root, version: VERSION, initialized, ...(status ?? emptyStatus()) });
  });

  api.post("/init", async (c) => {
    const workspace = await get();
    return c.json(await workspace.initWorkspace());
  });

  api.get("/workspaces", async (c) => {
    const current = await getStorage();
    return c.json({ active: current.activeWorkspace, list: current.workspaces });
  });

  api.post("/workspaces", async (c) => {
    const body = await c.req.json<{ path?: string }>();
    if (!body.path) return c.json({ error: "缂哄皯 path" }, 400);
    const resolved = path.resolve(body.path);
    const current = await getStorage();
    const list = current.workspaces.includes(resolved) ? current.workspaces : [...current.workspaces, resolved];
    await persist({ ...current, workspaces: list, activeWorkspace: resolved });
    return c.json({ active: resolved, list });
  });

  api.post("/workspace", async (c) => {
    const body = await c.req.json<{ path?: string }>();
    if (!body.path) return c.json({ error: "缂哄皯 path" }, 400);
    const resolved = path.resolve(body.path);
    const current = await getStorage();
    if (!current.workspaces.includes(resolved)) return c.json({ error: "璇ュ伐浣滃尯涓嶅湪鐧藉悕鍗曞唴" }, 403);
    await persist({ ...current, activeWorkspace: resolved });
    return c.json({ active: resolved, list: current.workspaces });
  });

  api.get("/check", async (c) => c.json(await (await get()).check()));

  api.get("/today", async (c) => {
    const workspace = await get();
    const { initialized, status } = await workspace.readStatusSafe();
    if (!initialized || !status) return c.json(buildPlan(emptyStatus(), null, ["overview"]));

    const missing: string[] = [];
    if (!(await workspace.hasGoals())) missing.push("goals");
    const lastDate = status.records[0]?.date ?? "";
    if (!lastDate) missing.push("latest-summary");

    let summary = null;
    if (lastDate) {
      try {
        summary = await workspace.readSummary(lastDate);
      } catch {
        summary = null;
      }
    }
    return c.json(buildPlan(status, summary, missing));
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
    if (!DATE.test(date)) return c.json({ error: "鏃ユ湡鏍煎紡搴斾负 YYYY-MM-DD" }, 400);
    const workspace = await get();
    try {
      return c.json({ exists: true, summary: await workspace.readSummary(date) });
    } catch {
      return c.json({ exists: false, summary: null });
    }
  });

  api.put("/summaries/:date", async (c) => {
    const date = c.req.param("date");
    if (!DATE.test(date)) return c.json({ error: "鏃ユ湡鏍煎紡搴斾负 YYYY-MM-DD" }, 400);
    const body = await c.req.json<{ content?: string }>();
    if (typeof body.content !== "string") return c.json({ error: "缂哄皯 content" }, 400);

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
    if (!body.date || !DATE.test(body.date)) return c.json({ error: "鏃ユ湡鏍煎紡搴斾负 YYYY-MM-DD" }, 400);

    const scaffold: ScaffoldOptions = {};
    if (body.preview !== undefined) scaffold.preview = body.preview;
    if (body.next !== undefined) scaffold.next = body.next;
    if (body.skills !== undefined) scaffold.skills = body.skills;

    return c.json(await (await get()).scaffoldDay(body.date, scaffold));
  });

  api.post("/close", async (c) => {
    const body = await c.req.json<CloseDayInput & { dryRun?: boolean }>();
    if (!body.date || !DATE.test(body.date)) return c.json({ error: "鏃ユ湡鏍煎紡搴斾负 YYYY-MM-DD" }, 400);

    const input: CloseDayInput = { date: body.date };
    if (body.learned !== undefined) input.learned = body.learned;
    if (body.next !== undefined) input.next = body.next;
    if (body.didWhat !== undefined) input.didWhat = body.didWhat;
    if (body.link !== undefined) input.link = body.link;
    if (body.linkText !== undefined) input.linkText = body.linkText;
    if (body.latest !== undefined) input.latest = body.latest;

    return c.json(await (await get()).closeDay(input, { dryRun: body.dryRun }));
  });

  api.get("/agent", async (c) => c.json(await viewAgentConfig((await getStorage()).agentConfigPath)));

  api.put("/agent", async (c) => {
    const body = await c.req.json<{ baseURL?: string; model?: string; apiKey?: string; temperature?: number }>();
    const configPath = (await getStorage()).agentConfigPath;
    await saveAgentConfig(body, configPath);
    return c.json(await viewAgentConfig(configPath));
  });

  api.get("/storage", async (c) => c.json({ ...(await getStorage()), defaults }));

  api.put("/storage", async (c) => {
    const body = await c.req.json<{ agentConfigPath?: string; historyDir?: string }>();
    return c.json({ ...(await setStorage(body)), defaults });
  });

  api.get("/chat/sessions", async (c) => c.json(await listSessions(currentRoot, (await getStorage()).historyDir)));

  api.post("/chat/sessions", async (c) => {
    const body = await c.req.json<{ title?: string }>().catch(() => ({ title: undefined as string | undefined }));
    return c.json(await createSession(currentRoot, (await getStorage()).historyDir, body.title));
  });

  api.post("/chat/sessions/:id/activate", async (c) =>
    c.json(await activateSession(currentRoot, (await getStorage()).historyDir, c.req.param("id"))),
  );

  api.patch("/chat/sessions/:id", async (c) => {
    const body = await c.req.json<{ title?: string }>();
    if (typeof body.title !== "string" || body.title.trim() === "") {
      return c.json({ error: "缺少 title" }, 400);
    }
    return c.json(await renameSession(currentRoot, (await getStorage()).historyDir, c.req.param("id"), body.title));
  });

  api.delete("/chat/sessions/:id", async (c) =>
    c.json(await deleteSession(currentRoot, (await getStorage()).historyDir, c.req.param("id"))),
  );

  api.get("/chat/history", async (c) => c.json(await readActive(currentRoot, (await getStorage()).historyDir)));

  api.put("/chat/history", async (c) => {
    const body = await c.req.json<{ messages?: StoredMessage[] }>();
    await writeActive(currentRoot, (await getStorage()).historyDir, Array.isArray(body.messages) ? body.messages : []);
    return c.json({ ok: true });
  });

  api.delete("/chat/history", async (c) => {
    await writeActive(currentRoot, (await getStorage()).historyDir, []);
    return c.json({ ok: true });
  });

  api.post("/chat", async (c) => {
    const body = await c.req.json<{ messages?: { role?: string; content?: string }[] }>();
    const messages = (body.messages ?? [])
      .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content ?? "" }));

    const workspace = await get();
    const agentConfigPath = (await getStorage()).agentConfigPath;
    return streamSSE(c, async (stream) => {
      const abort = new AbortController();
      stream.onAbort(() => abort.abort());

      for await (const event of runAgent({
        workspace,
        messages,
        configPath: agentConfigPath,
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
      const dispose = createWorkspaceWatcher(currentRoot, () => {
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
