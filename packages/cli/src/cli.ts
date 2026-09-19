import { Command } from "commander";
import { registerCheck } from "./commands/check.js";
import { registerClose } from "./commands/close.js";
import { registerContext } from "./commands/context.js";
import { registerInit } from "./commands/init.js";
import { registerMcp } from "./commands/mcp.js";
import { registerScaffold } from "./commands/scaffold.js";
import { registerServe } from "./commands/serve.js";
import { registerStatus } from "./commands/status.js";
import { registerToday } from "./commands/today.js";
import { VERSION } from "./version.js";

export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("myblog")
    .description("管理基于 markdown 的学习工作区")
    .version(VERSION)
    .option("-C, --root <dir>", "工作区根目录", process.env.MYBLOG_ROOT ?? process.cwd());

  registerStatus(program);
  registerToday(program);
  registerContext(program);
  registerScaffold(program);
  registerClose(program);
  registerCheck(program);
  registerServe(program);
  registerInit(program);
  registerMcp(program);

  await program.parseAsync(argv);
}
