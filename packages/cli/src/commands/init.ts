import type { Command } from "commander";
import { rootOf } from "../context.js";
import { initWorkspace, parseAgents } from "../templates.js";

interface InitCliOptions {
  agent: string;
  force?: boolean;
}

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("把学习循环模板写入工作区（opencode / claude / cursor / AGENTS.md）")
    .option("-a, --agent <list>", "逗号分隔：opencode,claude,cursor,agents,all", "all")
    .option("--force", "覆盖已存在的命令 / skill 文件")
    .action(async (options: InitCliOptions) => {
      const root = rootOf(program);
      const agents = parseAgents(options.agent);
      const result = await initWorkspace({ root, agents, force: options.force });

      for (const file of result.written) console.log(`写入  ${file}`);
      for (const file of result.skipped) console.log(`跳过（已存在，--force 可覆盖）  ${file}`);
      console.log(`完成：写入 ${result.written.length}，跳过 ${result.skipped.length}。`);
    });
}
