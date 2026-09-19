import type { Command } from "commander";
import { buildPlan } from "@myblog/core";
import { openWorkspace } from "../context.js";
import { firstLine } from "../format.js";

interface TodayOptions {
  json?: boolean;
}

export function registerToday(program: Command): void {
  program
    .command("today")
    .description("汇总今日上下文：阶段、活跃能力、下次继续、最近总结")
    .option("--json", "以 JSON 输出")
    .action(async (options: TodayOptions) => {
      const workspace = await openWorkspace(program);
      const status = await workspace.readStatus();
      const lastDate = status.records[0]?.date ?? "";

      let summary = null;
      if (lastDate) {
        try {
          summary = await workspace.readSummary(lastDate);
        } catch {
          summary = null;
        }
      }

      const plan = buildPlan(status, summary);
      if (options.json) {
        console.log(JSON.stringify(plan, null, 2));
        return;
      }

      const lines: string[] = [];
      lines.push(`阶段        ${plan.stageIds.join(" / ") || "（未识别）"}`);
      for (const capability of plan.active) {
        lines.push(`今日能力    ${capability.id} ${capability.name} — ${capability.question}`);
      }
      lines.push(`下次从哪继续 ${plan.next || "（空）"}`);
      if (plan.lastDate) {
        lines.push("");
        lines.push(`最近总结    ${plan.lastDate}${plan.lastSkills.length ? `（${plan.lastSkills.join(" ")}）` : ""}`);
        lines.push(`  ${firstLine(plan.lastNext) || "（没写下次从哪继续）"}`);
      }
      console.log(lines.join("\n"));
    });
}
