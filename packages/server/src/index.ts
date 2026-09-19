import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp, type AppOptions } from "./app.js";

export { createApp } from "./app.js";
export { createApi } from "./api.js";
export type { AppOptions } from "./app.js";

export interface StartOptions extends AppOptions {
  port: number;
  hostname?: string;
}

export function defaultWebRoot(): string {
  return fileURLToPath(new URL("../../web/dist", import.meta.url));
}

export function startServer(options: StartOptions) {
  const app = createApp(options);
  return serve({
    fetch: app.fetch,
    port: options.port,
    hostname: options.hostname ?? "127.0.0.1",
  });
}
