import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  buildContext,
  diffLines,
  type CloseDayInput,
  type ScaffoldOptions,
  type Workspace,
} from "@myblog/core";
import type { ToolSpec } from "./provider.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const READ_LIMIT = 256 * 1024;
const WRITE_LIMIT = 1024 * 1024;
const LIST_LIMIT = 500;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "release"]);

function resolveInside(root: string, target: unknown): string {
  const value = typeof target === "string" ? target.trim() : "";
  if (value === "") throw new Error("路径不能为空");
  if (isAbsolute(value)) throw new Error("请使用相对工作区根目录的路径");
  const resolved = resolve(root, value);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("路径超出工作区范围");
  return resolved;
}

function resolveOrError(root: string, target: unknown): string | { error: string } {
  try {
    return resolveInside(root, target);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function toRelative(root: string, absolute: string): string {
  const rel = relative(root, absolute);
  return rel === "" ? "." : rel.split("\\").join("/");
}

function preferredEol(content: string, before: string): string {
  if (!before.includes("\r\n")) return content;
  return content.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
}

function isBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 8192).includes(0);
}

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
    {
      type: "function",
      function: {
        name: "fs_list",
        description: "列出工作区内某个目录的文件与子目录（相对工作区根目录的路径）。",
        parameters: {
          type: "object",
          properties: { path: { type: "string", description: "相对路径，默认 .（工作区根目录）" } },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "fs_read",
        description: "读取工作区内的文本文件（相对路径）。超过 256KB 只返回开头并标记 truncated。",
        parameters: {
          type: "object",
          properties: { path: { type: "string", description: "相对工作区根目录的文件路径" } },
          required: ["path"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "fs_write",
        description:
          "把文本写入工作区内的文件（相对路径，父目录会自动创建）。默认 dryRun=true，只返回 diff 预览，不会落盘；必须先把 diff 给用户确认，用户同意后再以 dryRun=false 调用才真正写入。",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "相对工作区根目录的文件路径" },
            content: { type: "string", description: "完整的新内容（整体覆盖该文件）" },
            dryRun: { type: "boolean", description: "默认 true；确认后传 false 才落盘" },
          },
          required: ["path", "content"],
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

    case "fs_list": {
      const absolute = resolveOrError(workspace.root, args.path ?? ".");
      if (typeof absolute !== "string") return absolute;
      let info;
      try {
        info = await stat(absolute);
      } catch {
        return { error: `目录不存在：${toRelative(workspace.root, absolute)}` };
      }
      if (!info.isDirectory()) return { error: "这是文件，请用 fs_read 读取" };

      const dirents = await readdir(absolute, { withFileTypes: true });
      const entries: { name: string; type: "dir" | "file"; size: number; path: string }[] = [];
      for (const dirent of dirents) {
        const isDir = dirent.isDirectory();
        if (isDir && SKIP_DIRS.has(dirent.name)) continue;
        const child = join(absolute, dirent.name);
        let size = 0;
        if (!isDir) {
          try {
            size = (await stat(child)).size;
          } catch {
            size = 0;
          }
        }
        entries.push({ name: dirent.name, type: isDir ? "dir" : "file", size, path: toRelative(workspace.root, child) });
      }
      entries.sort((left, right) =>
        left.type === right.type ? left.name.localeCompare(right.name) : left.type === "dir" ? -1 : 1,
      );

      return {
        path: toRelative(workspace.root, absolute),
        entries: entries.slice(0, LIST_LIMIT),
        truncated: entries.length > LIST_LIMIT,
      };
    }

    case "fs_read": {
      const absolute = resolveOrError(workspace.root, args.path);
      if (typeof absolute !== "string") return absolute;
      let info;
      try {
        info = await stat(absolute);
      } catch {
        return { error: `文件不存在：${toRelative(workspace.root, absolute)}` };
      }
      if (info.isDirectory()) return { error: "这是目录，请用 fs_list 列出" };

      const buffer = await readFile(absolute);
      if (isBinary(buffer)) return { error: "看起来是二进制文件，暂不支持读取" };
      return {
        path: toRelative(workspace.root, absolute),
        size: info.size,
        truncated: buffer.length > READ_LIMIT,
        content: buffer.subarray(0, READ_LIMIT).toString("utf8"),
      };
    }

    case "fs_write": {
      const absolute = resolveOrError(workspace.root, args.path);
      if (typeof absolute !== "string") return absolute;
      if (typeof args.content !== "string") return { error: "缺少 content" };
      if (Buffer.byteLength(args.content, "utf8") > WRITE_LIMIT) return { error: "内容超过 1MB，已拒绝写入" };

      let before = "";
      let exists = true;
      try {
        before = await readFile(absolute, "utf8");
      } catch {
        exists = false;
      }

      const content = preferredEol(args.content, before);
      const path = toRelative(workspace.root, absolute);
      const dryRun = args.dryRun !== false;
      const diff = diffLines(before, content);

      if (dryRun) {
        return { path, dryRun: true, created: !exists, unchanged: before === content, bytes: Buffer.byteLength(content, "utf8"), diff };
      }

      try {
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, content, "utf8");
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
      return { path, dryRun: false, created: !exists, bytes: Buffer.byteLength(content, "utf8"), diff };
    }

    default:
      return { error: `未知工具：${name}` };
  }
}
