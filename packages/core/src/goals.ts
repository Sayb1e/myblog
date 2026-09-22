import { readFile } from "node:fs/promises";
import { findSection, splitSections } from "./markdown.js";
import { findFirstTable, formatTableRow, splitTableRow } from "./table.js";

export interface Capability {
  id: string;
  name: string;
  question: string;
  status: string;
}

export interface GoalsDoc {
  path: string;
  raw: string;
  currentStage: string;
  stageIds: string[];
  capabilities: Capability[];
  order: string[];
}

const STAGE_TITLE = "当前阶段";
const CAPABILITY_TITLE = "能力编号";
const ORDER_TITLE = "阶段顺序";

function parseNumberedList(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => /^\s*\d+\.\s+(.*)$/.exec(line)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

export function activeStageIds(currentStage: string): string[] {
  const bold = [...currentStage.matchAll(/\*\*(G\d+)\*\*/g)]
    .map((match) => match[1])
    .filter((id): id is string => id !== undefined);
  if (bold.length > 0) return [...new Set(bold)];
  return [...new Set(currentStage.match(/G\d+/g) ?? [])];
}

export function parseGoals(raw: string, path = ""): GoalsDoc {
  const sections = splitSections(raw);
  const currentStage = findSection(sections, STAGE_TITLE)?.body.trim() ?? "";
  const stageIds = activeStageIds(currentStage);

  const capabilities: Capability[] = [];
  const capabilitySection = findSection(sections, CAPABILITY_TITLE);
  if (capabilitySection) {
    const table = findFirstTable(capabilitySection.body, capabilitySection.bodyStart);
    for (const row of table?.rows ?? []) {
      const [id = "", name = "", question = "", status = ""] = row;
      capabilities.push({ id: id.replace(/`/g, ""), name, question, status });
    }
  }

  return {
    path,
    raw,
    currentStage,
    stageIds,
    capabilities,
    order: parseNumberedList(findSection(sections, ORDER_TITLE)?.body ?? ""),
  };
}

export async function readGoals(path: string): Promise<GoalsDoc> {
  return parseGoals(await readFile(path, "utf8"), path);
}

export function getCapability(goals: GoalsDoc, id: string): Capability | undefined {
  return goals.capabilities.find((capability) => capability.id === id);
}

export function updateCapabilityStatus(raw: string, id: string, status: string): string {
  const sections = splitSections(raw);
  const capabilitySection = findSection(sections, CAPABILITY_TITLE);
  if (!capabilitySection) return raw;

  const table = findFirstTable(capabilitySection.body, capabilitySection.bodyStart);
  if (!table) return raw;

  const index = table.rows.findIndex((cells) => (cells[0] ?? "").replace(/`/g, "").trim() === id);
  const line = index < 0 ? undefined : table.rowLines[index];
  if (line === undefined) return raw;

  const cells = splitTableRow(line);
  const column = cells.length >= 4 ? 3 : cells.length - 1;
  if (column < 0 || cells[column] === status) return raw;
  cells[column] = status;

  const at = raw.indexOf(line, table.start);
  if (at < 0) return raw;
  return raw.slice(0, at) + formatTableRow(cells) + raw.slice(at + line.length);
}
