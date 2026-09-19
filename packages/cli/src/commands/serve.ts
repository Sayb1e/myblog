import { randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import type { Command } from "commander";
import { rootOf } from "../context.js";

interface ServeOptions {
  port: string;
  host: string;
  web?: string;
  apiOnly?: boolean;
  allowRemote?: boolean;
  token?: string;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function isLoopback(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

export function registerServe(program: Command): void {
  program
    .command("serve")
    .description("启动本地仪表盘（API + Web）")
    .option("-p, --port <port>", "端口", "5174")
    .option("--host <host>", "监听地址", "127.0.0.1")
    .option("--web <dir>", "前端构建目录（默认 packages/web/dist）")
    .option("--api-only", "只提供 API")
    .option("--allow-remote", "允许绑定非本机地址（会强制要求 token）")
    .option("--token <token>", "写接口 token（默认 MYBLOG_TOKEN 或随机生成）")
    .action(async (options: ServeOptions) => {
      if (!isLoopback(options.host) && options.allowRemote !== true) {
        throw new Error(
          `拒绝绑定非本机地址 ${options.host}：本地写 API 默认无鉴权。确需远程请加 --allow-remote（会要求 token）。`,
        );
      }

      const remote = !isLoopback(options.host);
      const explicitToken = options.token ?? process.env.MYBLOG_TOKEN;
      const token = remote ? explicitToken ?? randomBytes(16).toString("hex") : explicitToken;

      const { startServer, defaultWebRoot } = await import("@myblog/server");
      const root = rootOf(program);
      const port = Number(options.port);

      let webRoot: string | false = false;
      if (!options.apiOnly) {
        const candidate = options.web ?? defaultWebRoot();
        if (await exists(candidate)) {
          webRoot = candidate;
        } else {
          console.warn(`未找到前端构建产物：${candidate}（先跑 npm run build --workspace @myblog/web）。当前只提供 API。`);
        }
      }

      startServer({ root, port, hostname: options.host, webRoot, token });
      console.log(`MyBlog 仪表盘: http://${options.host}:${port}`);
      console.log(`工作区: ${root}`);
      if (token !== undefined) {
        console.log(`写接口已启用 token：${token}`);
        console.log("客户端请在请求头带 x-myblog-token（或在 Web UI 中按提示输入）。");
      }
    });
}
