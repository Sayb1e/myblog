import type { Command } from "commander";
import { openWorkspace } from "../context.js";
import { buildContext } from "../bundle.js";

interface ContextOptions {
  json?: boolean;
}

export function registerContext(program: Command): void {
  program
    .command("context")
    .description("输出给 AI agent 的完整上下文（状态 + 今日 + 校验 + 最近总结）")
    .option("--json", "以 JSON 输出")
    .action(async (options: ContextOptions) => {
      const workspace = await openWorkspace(program);
      const bundle = await buildContext(workspace);

      if (options.json) {
        console.log(JSON.stringify(bundle, null, 2));
        return;
      }

      const lines: string[] = [];
      lines.push(`工作区      ${bundle.root}`);
      lines.push(`阶段        ${bundle.stageIds.join(" / ") || "（未识别）"}`);
      for (const capability of bundle.active) {
        lines.push(`活跃能力    ${capability.id} ${capability.name} — ${capability.status}`);
      }
      lines.push(`下次从哪继续 ${bundle.next || "（空）"}`);
      lines.push(`学到哪了    ${bundle.progress.learned || "（空）"}`);
      lines.push(`最近一次    ${bundle.progress.latest || "（空）"}`);
      if (bundle.lastDate) {
        lines.push(
          `最近总结    ${bundle.lastDate}${bundle.lastSkills.length ? `（${bundle.lastSkills.join(" ")}）` : ""}`,
        );
      }
      lines.push(`校验        ${bundle.check.ok ? "通过" : `有问题（${bundle.check.issues.length}）`}`);
      console.log(lines.join("\n"));
    });
}
