import type { Command } from "commander";
import type { ScaffoldOptions } from "@myblog/core";
import { localDate, openWorkspace } from "../context.js";

interface ScaffoldCliOptions {
  preview?: string;
  next?: string;
  skills?: string;
}

export function registerScaffold(program: Command): void {
  program
    .command("scaffold [date]")
    .description("创建当天的总结骨架（已存在则不覆盖）")
    .option("--preview <text>", "填入「前情提要」")
    .option("--next <text>", "填入「下次从哪继续」")
    .option("--skills <ids>", "当前 G 编号，逗号或空格分隔")
    .action(async (dateArg: string | undefined, options: ScaffoldCliOptions) => {
      const workspace = await openWorkspace(program);
      const date = dateArg ?? localDate();

      const scaffold: ScaffoldOptions = {};
      if (options.preview !== undefined) scaffold.preview = options.preview;
      if (options.next !== undefined) scaffold.next = options.next;
      if (options.skills !== undefined) {
        scaffold.skills = options.skills.split(/[\s,]+/).filter((id) => id !== "");
      }

      const result = await workspace.scaffoldDay(date, scaffold);
      console.log(result.created ? `已创建 ${result.path}` : `已存在，未覆盖：${result.path}`);
    });
}
