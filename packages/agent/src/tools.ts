import { readFile } from "node:fs/promises";
import {
  buildContext,
  diffLines,
  type CloseDayInput,
  type ScaffoldOptions,
  type Workspace,
} from "@myblog/core";
import type { ToolSpec } from "./provider.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toolSpecs(): ToolSpec[] {
  return [
    {
      type: "function",
      function: {
        name: "myblog_context",
        description:
          "读取学习工作区全量上下文：当前阶段、活跃能力、学到哪/下次继续、最近总结、学习记录、校验结果。规划当天任务前先调用。",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "myblog_check",
        description: "校验工作区一致性：G 编号定义、链接可达、日期目录是否有总结、根目录疑似附件。",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "myblog_read_summary",
        description: "读取某天的 YYYY-MM-DD/总结.md。",
        parameters: {
          type: "object",
          properties: { date: { type: "string", description: "日期 YYYY-MM-DD" } },
          required: ["date"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "myblog_scaffold",
        description: "为某天创建 总结.md 骨架（已存在不覆盖）。用户同意后再调用。",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "日期 YYYY-MM-DD" },
            preview: { type: "string", description: "填入「前情提要」" },
            next: { type: "string", description: "填入「下次从哪继续」" },
            skills: { type: "array", items: { type: "string" }, description: "涉及的 G 编号" },
          },
          required: ["date"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "myblog_close",
        description:
          "把当天结论写回总览（进度 + 学习记录）。默认 dryRun=true，只返回 diff 预览；把 diff 给用户确认后，再以 dryRun=false 调用才真正写入。",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "日期 YYYY-MM-DD" },
            learned: { type: "string", description: "「学到哪了」" },
            next: { type: "string", description: "「下次从哪继续」" },
            didWhat: { type: "string", description: "学习记录「这次做了什么」，填了才加记录" },
            link: { type: "string", description: "链接，默认 ./<date>/总结.md" },
            linkText: { type: "string", description: "链接文字，默认「总结」" },
            dryRun: { type: "boolean", description: "默认 true；确认后传 false 才落盘" },
          },
          required: ["date"],
          additionalProperties: false,
        },
      },
    },
  ];
}

export async function executeTool(workspace: Workspace, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "myblog_context":
      return buildContext(workspace);

    case "myblog_check":
      return workspace.check();

    case "myblog_read_summary": {
      const date = String(args.date ?? "");
      if (!DATE.test(date)) return { error: "日期格式应为 YYYY-MM-DD" };
      try {
        return await workspace.readSummary(date);
      } catch {
        return { exists: false, hint: `没有 ${date} 的总结` };
      }
    }

    case "myblog_scaffold": {
      const date = String(args.date ?? "");
      if (!DATE.test(date)) return { error: "日期格式应为 YYYY-MM-DD" };
      const options: ScaffoldOptions = {};
      if (typeof args.preview === "string") options.preview = args.preview;
      if (typeof args.next === "string") options.next = args.next;
      if (Array.isArray(args.skills)) options.skills = args.skills.map((skill) => String(skill));
      return workspace.scaffoldDay(date, options);
    }

    case "myblog_close": {
      const date = String(args.date ?? "");
      if (!DATE.test(date)) return { error: "日期格式应为 YYYY-MM-DD" };

      const dryRun = args.dryRun !== false;
      const input: CloseDayInput = { date };
      if (typeof args.learned === "string") input.learned = args.learned;
      if (typeof args.next === "string") input.next = args.next;
      if (typeof args.didWhat === "string") input.didWhat = args.didWhat;
      if (typeof args.link === "string") input.link = args.link;
      if (typeof args.linkText === "string") input.linkText = args.linkText;

      const before = await readFile(workspace.overviewPath, "utf8");
      const result = await workspace.closeDay(input, { dryRun });
      return { ...result, dryRun, diff: result.preview ? diffLines(before, result.preview) : [] };
    }

    default:
      return { error: `未知工具：${name}` };
  }
}
