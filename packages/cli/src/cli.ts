import { Command } from "commander";
import { registerInit } from "./commands/init.js";
import { registerMcp } from "./commands/mcp.js";
import { registerStatus } from "./commands/status.js";
import { VERSION } from "./version.js";

export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("myblog")
    .description("管理基于 markdown 的学习工作区")
    .version(VERSION)
    .option("-C, --root <dir>", "工作区根目录", process.env.MYBLOG_ROOT ?? process.cwd());

  registerStatus(program);
  registerInit(program);
  registerMcp(program);

  await program.parseAsync(argv);
}
