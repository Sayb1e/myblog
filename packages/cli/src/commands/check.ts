import type { Command } from "commander";
import { openWorkspace } from "../context.js";

interface CheckOptions {
  json?: boolean;
  strict?: boolean;
}

export function registerCheck(program: Command): void {
  program
    .command("check")
    .description("校验工作区一致性（G 编号、链接、日期目录、根目录附件）")
    .option("--json", "以 JSON 输出")
    .option("--strict", "有警告时也返回失败")
    .action(async (options: CheckOptions) => {
      const workspace = await openWorkspace(program);
      const result = await workspace.check();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const issue of result.issues) {
          const level = issue.level === "error" ? "错误" : "警告";
          console.log(`${level}  ${issue.code.padEnd(20)} ${issue.message}`);
        }
        console.log(result.issues.length === 0 ? "检查通过，没有问题。" : `共 ${result.issues.length} 条。`);
      }

      if (!result.ok || (options.strict === true && result.issues.length > 0)) {
        process.exitCode = 1;
      }
    });
}
