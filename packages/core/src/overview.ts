import { readFile } from "node:fs/promises";
import {
  findSection,
  readLabeledParagraph,
  splitSections,
  upsertLabeledParagraph,
  type Section,
} from "./markdown.js";
import { findFirstTable, insertTableRow, parseLink } from "./table.js";

export interface ProgressSnapshot {
  learned: string;
  next: string;
  latest: string;
}

export interface LearningRecord {
  date: string;
  didWhat: string;
  link: string;
  linkText: string;
}

export interface OverviewDoc {
  path: string;
  raw: string;
  background: string;
  progress: ProgressSnapshot;
  records: LearningRecord[];
  directions: string[];
  tools: string[][];
}

const PROGRESS_TITLE = "现在学到哪了";
const RECORDS_TITLE = "学习记录";
const BACKGROUND_TITLE = "背景与目标";
const DIRECTIONS_TITLE = "学习方向";
const TOOLS_TITLE = "工具与环境备忘";

function replaceSectionBody(markdown: string, section: Section, body: string): string {
  return `${markdown.slice(0, section.bodyStart)}${body}${markdown.slice(section.end)}`;
}

function parseNumberedList(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => /^\s*\d+\.\s+(.*)$/.exec(line)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

export function parseOverview(raw: string, path = ""): OverviewDoc {
  const sections = splitSections(raw);

  const progressSection = findSection(sections, PROGRESS_TITLE);
  const progress: ProgressSnapshot = {
    learned: progressSection ? readLabeledParagraph(progressSection.body, "学到哪了") : "",
    next: progressSection ? readLabeledParagraph(progressSection.body, "下次从哪继续") : "",
    latest: progressSection ? readLabeledParagraph(progressSection.body, "最近一次") : "",
  };

  const records: LearningRecord[] = [];
  const recordsSection = findSection(sections, RECORDS_TITLE);
  if (recordsSection) {
    const table = findFirstTable(recordsSection.body, recordsSection.bodyStart);
    for (const row of table?.rows ?? []) {
      const [date = "", didWhat = "", linkCell = ""] = row;
      const link = parseLink(linkCell);
      records.push({
        date,
        didWhat: didWhat.replace(/\*\*/g, ""),
        link: link?.target ?? "",
        linkText: link?.text ?? linkCell,
      });
    }
  }

  return {
    path,
    raw,
    background: findSection(sections, BACKGROUND_TITLE)?.body.trim() ?? "",
    progress,
    records,
    directions: parseNumberedList(findSection(sections, DIRECTIONS_TITLE)?.body ?? ""),
    tools: findFirstTable(findSection(sections, TOOLS_TITLE)?.body ?? "")?.rows ?? [],
  };
}

export async function readOverview(path: string): Promise<OverviewDoc> {
  return parseOverview(await readFile(path, "utf8"), path);
}

export function updateProgress(raw: string, patch: Partial<ProgressSnapshot>): string {
  const sections = splitSections(raw);
  const section = findSection(sections, PROGRESS_TITLE);
  if (!section) throw new Error(`找不到章节「${PROGRESS_TITLE}」`);

  let body = section.body;
  if (patch.learned !== undefined) body = upsertLabeledParagraph(body, "学到哪了", patch.learned);
  if (patch.next !== undefined) body = upsertLabeledParagraph(body, "下次从哪继续", patch.next);
  if (patch.latest !== undefined) body = upsertLabeledParagraph(body, "最近一次", patch.latest);
  return replaceSectionBody(raw, section, body);
}

export function addRecord(raw: string, record: LearningRecord): string {
  const sections = splitSections(raw);
  const section = findSection(sections, RECORDS_TITLE);
  if (!section) throw new Error(`找不到章节「${RECORDS_TITLE}」`);

  const table = findFirstTable(section.body, section.bodyStart);
  if (!table) throw new Error(`章节「${RECORDS_TITLE}」里没有表格`);

  const linkCell = record.link ? `[${record.linkText || record.date}](${record.link})` : record.linkText;
  const updated = insertTableRow(raw, table, [record.date, record.didWhat, linkCell], "top");
  return updated;
}
