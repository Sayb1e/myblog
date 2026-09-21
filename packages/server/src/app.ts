import path from "node:path";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApi } from "./api.js";

export interface AppOptions {
  root: string;
  webRoot?: string | false;
  token?: string;
  agentConfigPath?: string;
  historyDir?: string;
  workspaces?: string[];
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  });

  app.route(
    "/api",
    createApi(options.root, {
      token: options.token,
      agentConfigPath: options.agentConfigPath,
      historyDir: options.historyDir,
      workspaces: options.workspaces,
    }),
  );
  app.all("/api/*", (c) => c.json({ error: "接口不存在" }, 404));

  if (options.webRoot) {
    const webRoot = options.webRoot;
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", serveStatic({ path: path.join(webRoot, "index.html") }));
  }

  return app;
}
