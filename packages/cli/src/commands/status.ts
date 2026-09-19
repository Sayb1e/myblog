import type { Command } from "commander";
import type { WorkspaceStatus } from "@myblog/core";
import { openWorkspace } from "../context.js";
import { firstLine } from "../format.js";

interface StatusOptions {
  json?: boolean;
}

function renderStatus(status: WorkspaceStatus): string {
  const lines: string[] = [];
  lines.push(`阶段      ${status.stageIds.join(" / ") || "（未识别）"}`);
  lines.push(`说明      ${firstLine(status.stage) || "（空）"}`);
  for (const capability of status.capabilities) {
    if (!capability.active) continue;
    lines.push(`能力      ${capability.id} ${capability.name} — ${capability.status}`);
  }
  lines.push("");
  lines.push(`学到哪了  ${status.progress.learned || "（空）"}`);
  lines.push(`下次继续  ${status.progress.next || "（空）"}`);
  lines.push(`最近一次  ${status.progress.latest || "（空）"}`);
  lines.push("");
  lines.push("学习记录");
  for (const record of status.records.slice(0, 5)) {
    lines.push(`  ${record.date}  ${record.didWhat}`);
  }
  return lines.join("\n");
}

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("显示当前阶段、活跃能力、进度与最近记录")
    .option("--json", "以 JSON 输出")
    .action(async (options: StatusOptions) => {
      const workspace = await openWorkspace(program);
      const status = await workspace.readStatus();
      console.log(options.json ? JSON.stringify(status, null, 2) : renderStatus(status));
    });
}
