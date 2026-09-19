import type { Command } from "commander";
import { openWorkspace } from "../context.js";
import { runMcpServer } from "../mcp.js";

export function registerMcp(program: Command): void {
  program
    .command("mcp")
    .description("以 stdio 启动 MCP server，供 opencode / Claude / Cursor 等客户端调用")
    .action(async () => {
      const workspace = await openWorkspace(program);
      await runMcpServer(workspace);
    });
}
