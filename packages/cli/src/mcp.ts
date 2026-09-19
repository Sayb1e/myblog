import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { CloseDayInput, Workspace } from "@myblog/core";
import { buildContext } from "./bundle.js";
import { diffLines } from "./format.js";
import { VERSION } from "./version.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function message(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function createMcpServer(workspace: Workspace): McpServer {
  const server = new McpServer({ name: "myblog", version: VERSION });

  server.registerTool(
    "myblog_context",
    {
      title: "Get learning workspace context",
      description:
        "读取学习工作区全量上下文：当前阶段、活跃能力、学到哪/下次继续、最近总结、学习记录、校验结果。做任何学习规划前先调用它，不要臆造进度。",
      inputSchema: {},
    },
    async () => json(await buildContext(workspace)),
  );

  server.registerTool(
    "myblog_check",
    {
      title: "Validate workspace",
      description: "校验工作区一致性：G 编号是否有定义、链接是否可达、日期目录是否有总结、根目录是否有疑似附件。",
      inputSchema: {},
    },
    async () => json(await workspace.check()),
  );

  server.registerTool(
    "myblog_read_summary",
    {
      title: "Read a daily summary",
      description: "读取某一天的 YYYY-MM-DD/总结.md（解析后的字段与原始 markdown）。",
      inputSchema: { date: z.string().describe("日期，格式 YYYY-MM-DD") },
    },
    async ({ date }) => {
      if (!DATE.test(date)) return message("日期格式应为 YYYY-MM-DD");
      try {
        return json(await workspace.readSummary(date));
      } catch {
        return message(`没有 ${date} 的总结（${workspace.summaryPath(date)}）`);
      }
    },
  );

  server.registerTool(
    "myblog_scaffold",
    {
      title: "Scaffold a daily summary",
      description:
        "为某天创建 总结.md 骨架（已存在则不会覆盖）。用户批准后再调用；随后可用编辑工具在「## 这次」里补充内容。",
      inputSchema: {
        date: z.string().describe("日期，格式 YYYY-MM-DD"),
        preview: z.string().optional().describe("填入「前情提要」"),
        next: z.string().optional().describe("填入「下次从哪继续」"),
        skills: z.array(z.string()).optional().describe("当天涉及的 G 编号"),
      },
    },
    async ({ date, preview, next, skills }) => {
      if (!DATE.test(date)) return message("日期格式应为 YYYY-MM-DD");
      const result = await workspace.scaffoldDay(date, { preview, next, skills });
      return json(result);
    },
  );

  server.registerTool(
    "myblog_close",
    {
      title: "Close the day (write back to overview)",
      description:
        "把当天结论写回总览（进度 + 学习记录）。默认 dryRun=true，只返回 diff 预览、不写盘；把 diff 给用户确认后，再以 dryRun=false 调用才会真正写入。",
      inputSchema: {
        date: z.string().describe("日期，格式 YYYY-MM-DD"),
        learned: z.string().optional().describe("「学到哪了」"),
        next: z.string().optional().describe("「下次从哪继续」"),
        didWhat: z.string().optional().describe("学习记录里「这次做了什么」，填了才加记录"),
        link: z.string().optional().describe("学习记录链接，默认 ./<date>/总结.md"),
        linkText: z.string().optional().describe("链接文字，默认「总结」"),
        dryRun: z.boolean().optional().describe("默认 true；确认后传 false 才落盘"),
      },
    },
    async (args) => {
      if (!DATE.test(args.date)) return message("日期格式应为 YYYY-MM-DD");

      const dryRun = args.dryRun !== false;
      const input: CloseDayInput = { date: args.date };
      if (args.learned !== undefined) input.learned = args.learned;
      if (args.next !== undefined) input.next = args.next;
      if (args.didWhat !== undefined) input.didWhat = args.didWhat;
      if (args.link !== undefined) input.link = args.link;
      if (args.linkText !== undefined) input.linkText = args.linkText;

      const before = await readFile(workspace.overviewPath, "utf8");
      const result = await workspace.closeDay(input, { dryRun });
      const diff = result.preview ? diffLines(before, result.preview) : [];
      return json({ ...result, dryRun, diff });
    },
  );

  return server;
}

export async function runMcpServer(workspace: Workspace): Promise<void> {
  const server = createMcpServer(workspace);
  await server.connect(new StdioServerTransport());
}
