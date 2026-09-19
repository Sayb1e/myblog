import { readFile } from "node:fs/promises";
import { findSection, splitSections } from "./markdown.js";

export interface SummaryDoc {
  path: string;
  raw: string;
  date: string;
  preview: string;
  thisTime: string;
  skills: string[];
  next: string;
}

export interface ScaffoldOptions {
  preview?: string;
  next?: string;
  skills?: string[];
  eol?: string;
}

const DATE_HEADING = /^#\s+(\d{4}-\d{2}-\d{2})\s*$/m;
const PREVIEW_TITLE = "前情提要";
const THIS_TITLE = "这次";
const NEXT_TITLE = "下次从哪继续";
const CAPABILITY_LINE = /^\s*能力\s*[:：]/;

function extractSkills(body: string): string[] {
  const ids = new Set<string>();
  for (const line of body.split(/\r?\n/)) {
    if (!CAPABILITY_LINE.test(line)) continue;
    for (const id of line.match(/G\d+/g) ?? []) ids.add(id);
  }
  return [...ids];
}

export function parseSummary(raw: string, path = ""): SummaryDoc {
  const sections = splitSections(raw);
  const thisTime = findSection(sections, THIS_TITLE)?.body.trim() ?? "";
  return {
    path,
    raw,
    date: DATE_HEADING.exec(raw)?.[1]?.trim() ?? "",
    preview: findSection(sections, PREVIEW_TITLE)?.body.trim() ?? "",
    thisTime,
    skills: extractSkills(thisTime),
    next: findSection(sections, NEXT_TITLE)?.body.trim() ?? "",
  };
}

export async function readSummary(path: string): Promise<SummaryDoc> {
  return parseSummary(await readFile(path, "utf8"), path);
}

export function scaffoldSummary(date: string, options: ScaffoldOptions = {}): string {
  const eol = options.eol ?? "\n";
  const preview = options.preview?.trim() || "（上次停在哪、这次准备干什么）";
  const next = options.next?.trim() || "（一句话即可；收工后同步改总览「现在学到哪了」）";
  const skills = options.skills?.length ? options.skills.join(" ") : "G?";
  return [
    `# ${date}`,
    "",
    "## 前情提要",
    "",
    preview,
    "",
    "## 这次",
    "",
    `能力：${skills}`,
    "",
    "（做了什么、关键结论、命令/代码、踩坑；附件相对路径）",
    "",
    "## 下次从哪继续",
    "",
    next,
    "",
  ].join(eol);
}
