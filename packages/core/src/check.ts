import { readFile, readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import type { WorkspaceConfig } from "./config.js";
import { parseGoals } from "./goals.js";
import { parseOverview } from "./overview.js";
import { parseSummary, type SummaryDoc } from "./daily.js";
import { parseLink } from "./table.js";

export type CheckLevel = "error" | "warn";

export interface CheckIssue {
  level: CheckLevel;
  code: string;
  message: string;
  path?: string;
}

export interface CheckResult {
  ok: boolean;
  issues: CheckIssue[];
}

const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;
const EXTERNAL_LINK = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

async function readTextOrNull(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function collectSkillIds(text: string, into: Map<string, string>, where: string): void {
  for (const id of text.match(/G\d+/g) ?? []) {
    if (!into.has(id)) into.set(id, where);
  }
}

export async function checkWorkspace(config: WorkspaceConfig): Promise<CheckResult> {
  const issues: CheckIssue[] = [];
  const add = (level: CheckLevel, code: string, message: string, target?: string): void => {
    issues.push(target === undefined ? { level, code, message } : { level, code, message, path: target });
  };

  const overviewRaw = await readTextOrNull(path.join(config.root, config.overview));
  const goalsRaw = await readTextOrNull(path.join(config.root, config.goals));
  if (overviewRaw === null) add("error", "missing-overview", `找不到总览文件：${config.overview}`, config.overview);
  if (goalsRaw === null) {
    add("warn", "missing-goals", `没有能力地图文件（${config.goals}）：阶段与能力地图会为空，可不创建`, config.goals);
  }

  const overview = overviewRaw === null ? null : parseOverview(overviewRaw, config.overview);
  const goals = goalsRaw === null ? null : parseGoals(goalsRaw, config.goals);
  const defined = new Set(goals?.capabilities.map((capability) => capability.id) ?? []);

  let entries: Dirent[] = [];
  try {
    entries = await readdir(config.root, { withFileTypes: true });
  } catch {
    add("error", "missing-root", `工作区根目录不存在：${config.root}`, config.root);
  }

  const dateDirs = entries
    .filter((entry) => entry.isDirectory() && DATE_DIR.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const summaries: SummaryDoc[] = [];
  for (const dir of dateDirs) {
    const relative = path.posix.join(dir, config.summaryFile);
    const raw = await readTextOrNull(path.join(config.root, dir, config.summaryFile));
    if (raw === null) {
      add("warn", "missing-summary", `日期目录 ${dir} 下没有 ${config.summaryFile}`, relative);
      continue;
    }
    summaries.push(parseSummary(raw, relative));
  }

  const referenced = new Map<string, string>();
  if (overview) collectSkillIds(overview.raw, referenced, config.overview);
  if (goals) collectSkillIds(goals.raw, referenced, config.goals);
  for (const summary of summaries) collectSkillIds(summary.raw, referenced, summary.path);
  for (const [id, where] of referenced) {
    if (!defined.has(id)) {
      add("error", "undefined-skill", `编号 ${id} 在 ${where} 出现，但「能力编号」表里没有定义`, where);
    }
  }

  if (overview) {
    const latest = parseLink(overview.progress.latest);
    if (!latest) {
      add("warn", "missing-latest", "「最近一次」没有可解析的链接", config.overview);
    } else if (!EXTERNAL_LINK.test(latest.target)) {
      if (!(await pathExists(path.resolve(config.root, latest.target)))) {
        add("error", "broken-latest", `「最近一次」链接不可达：${latest.target}`, config.overview);
      }
    }

    for (const record of overview.records) {
      if (!record.link || EXTERNAL_LINK.test(record.link)) continue;
      if (!(await pathExists(path.resolve(config.root, record.link)))) {
        add("warn", "broken-record", `学习记录链接不可达：${record.date} → ${record.link}`, config.overview);
      }
    }
  }

  const allowedFiles = new Set([config.overview, config.goals, config.configFile]);
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (DATE_DIR.test(entry.name) || entry.name === "node_modules") continue;
      add("warn", "stray-attachment", `根目录下的目录疑似附件/工程，应放进日期子目录：${entry.name}`, entry.name);
      continue;
    }
    if (allowedFiles.has(entry.name) || entry.name.endsWith(".md")) continue;
    add("warn", "stray-attachment", `根目录下的文件疑似附件，应放进日期子目录：${entry.name}`, entry.name);
  }

  return { ok: !issues.some((issue) => issue.level === "error"), issues };
}
