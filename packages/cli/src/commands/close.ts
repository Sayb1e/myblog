import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import type { CloseDayInput } from "@myblog/core";
import { localDate, openWorkspace } from "../context.js";
import { diffLines } from "../format.js";

interface CloseOptions {
  date?: string;
  learned?: string;
  next?: string;
  did?: string;
  link?: string;
  linkText?: string;
  dryRun?: boolean;
}

export function registerClose(program: Command): void {
  program
    .command("close")
    .description("把当天结论写回总览（进度 + 学习记录）")
    .option("--date <date>", "日期，默认今天")
    .option("--learned <text>", "覆盖「学到哪了」")
    .option("--next <text>", "覆盖「下次从哪继续」")
    .option("--did <text>", "新增一条学习记录")
    .option("--link <path>", "学习记录链接")
    .option("--link-text <text>", "学习记录链接文字")
    .option("--dry-run", "只预览不写盘")
    .action(async (options: CloseOptions) => {
      const workspace = await openWorkspace(program);
      const date = options.date ?? localDate();

      const input: CloseDayInput = { date };
      if (options.learned !== undefined) input.learned = options.learned;
      if (options.next !== undefined) input.next = options.next;
      if (options.did !== undefined) input.didWhat = options.did;

      const link = options.link ?? `./${date}/${workspace.config.summaryFile}`;
      const linkText = options.linkText ?? "总结";
      if (input.didWhat !== undefined) {
        input.link = link;
        input.linkText = linkText;
      }

      if (input.learned === undefined && input.next === undefined && input.didWhat === undefined) {
        throw new Error("没有要写回的内容：用 --learned / --next / --did 指定");
      }

      const before = await readFile(workspace.overviewPath, "utf8");
      const result = await workspace.closeDay(input, { dryRun: options.dryRun });

      if (!result.overviewChanged) {
        console.log("总览无变化（内容相同，已幂等跳过）。");
        return;
      }

      const label = options.dryRun ? "预览改动（未写盘）" : "已写回总览";
      console.log(`${label}：进度=${result.progressUpdated ? "更新" : "无"} 新记录=${result.recordAdded ? "是" : "否"}`);
      const diff = result.preview ? diffLines(before, result.preview) : [];
      for (const line of diff) console.log(`  ${line}`);
    });
}
