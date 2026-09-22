import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig, type WorkspaceConfig } from "./config.js";
import { detectEol } from "./markdown.js";
import { readGoals, type GoalsDoc } from "./goals.js";
import { parseGoals, updateCapabilityStatus } from "./goals.js";
import { scaffoldGoals, scaffoldOverview } from "./bootstrap.js";
import {
  addRecord,
  parseOverview,
  readOverview,
  updateProgress,
  type OverviewDoc,
  type ProgressSnapshot,
} from "./overview.js";
import { readSummary, scaffoldSummary, type ScaffoldOptions, type SummaryDoc } from "./daily.js";
import { buildStatus, type WorkspaceStatus } from "./status.js";
import { checkWorkspace, type CheckResult } from "./check.js";

export interface ScaffoldDayResult {
  created: boolean;
  path: string;
}

export interface CloseDayInput {
  date: string;
  learned?: string;
  next?: string;
  didWhat?: string;
  link?: string;
  linkText?: string;
  latest?: string;
}

export interface CloseDayResult {
  overviewChanged: boolean;
  progressUpdated: boolean;
  recordAdded: boolean;
  preview?: string;
}

export interface CloseDayOptions {
  dryRun?: boolean;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export class Workspace {
  readonly config: WorkspaceConfig;

  constructor(config: WorkspaceConfig) {
    this.config = config;
  }

  static async load(root: string, override: Partial<WorkspaceConfig> = {}): Promise<Workspace> {
    return new Workspace(await loadConfig(root, override));
  }

  get root(): string {
    return this.config.root;
  }

  get overviewPath(): string {
    return path.join(this.config.root, this.config.overview);
  }

  get goalsPath(): string {
    return path.join(this.config.root, this.config.goals);
  }

  dayDir(date: string): string {
    return path.join(this.config.root, date);
  }

  summaryPath(date: string): string {
    return path.join(this.dayDir(date), this.config.summaryFile);
  }

  async readOverview(): Promise<OverviewDoc> {
    return readOverview(this.overviewPath);
  }

  async readGoals(): Promise<GoalsDoc> {
    return readGoals(this.goalsPath);
  }

  async readSummary(date: string): Promise<SummaryDoc> {
    return readSummary(this.summaryPath(date));
  }

  async readStatus(): Promise<WorkspaceStatus> {
    const [overview, goals] = await Promise.all([this.readOverview(), this.readGoals()]);
    return buildStatus(overview, goals);
  }

  async hasOverview(): Promise<boolean> {
    return pathExists(this.overviewPath);
  }

  async hasGoals(): Promise<boolean> {
    return pathExists(this.goalsPath);
  }

  async setCapabilityStatus(id: string, status: string): Promise<{ changed: boolean }> {
    const raw = await readFile(this.goalsPath, "utf8");
    const next = updateCapabilityStatus(raw, id, status);
    if (next !== raw) await writeFile(this.goalsPath, next, "utf8");
    return { changed: next !== raw };
  }

  async readStatusSafe(): Promise<{ initialized: boolean; status: WorkspaceStatus | null }> {
    if (!(await this.hasOverview())) return { initialized: false, status: null };
    const overview = await this.readOverview();
    let goals: GoalsDoc;
    try {
      goals = await this.readGoals();
    } catch {
      goals = parseGoals("", this.goalsPath);
    }
    return { initialized: true, status: buildStatus(overview, goals) };
  }

  async initWorkspace(): Promise<{ created: string[] }> {
    const created: string[] = [];
    await mkdir(this.config.root, { recursive: true });
    if (!(await pathExists(this.overviewPath))) {
      await writeFile(this.overviewPath, scaffoldOverview(), "utf8");
      created.push(this.config.overview);
    }
    if (!(await pathExists(this.goalsPath))) {
      await writeFile(this.goalsPath, scaffoldGoals(), "utf8");
      created.push(this.config.goals);
    }
    return { created };
  }

  async check(): Promise<CheckResult> {
    return checkWorkspace(this.config);
  }

  async scaffoldDay(date: string, options: ScaffoldOptions = {}): Promise<ScaffoldDayResult> {
    const file = this.summaryPath(date);
    await mkdir(this.dayDir(date), { recursive: true });
    if (await pathExists(file)) return { created: false, path: file };

    let eol = "\n";
    try {
      eol = detectEol(await readFile(this.overviewPath, "utf8"));
    } catch {
      eol = "\n";
    }

    await writeFile(file, scaffoldSummary(date, { eol, ...options }), "utf8");
    return { created: true, path: file };
  }

  async closeDay(input: CloseDayInput, options: CloseDayOptions = {}): Promise<CloseDayResult> {
    const raw = await readFile(this.overviewPath, "utf8");
    const before = parseOverview(raw, this.overviewPath);

    let next = raw;
    const patch: Partial<ProgressSnapshot> = {};
    if (input.learned !== undefined) patch.learned = input.learned;
    if (input.next !== undefined) patch.next = input.next;

    const defaultLink = input.link ?? `./${input.date}/${this.config.summaryFile}`;
    const latestMarkdown = input.latest ?? `[${input.date}](${defaultLink})`;
    const newestRecord = before.records[0]?.date ?? "";
    if (newestRecord === "" || input.date >= newestRecord) {
      patch.latest = latestMarkdown;
    }

    let progressUpdated = false;
    if (Object.keys(patch).length > 0) {
      next = updateProgress(next, patch);
      progressUpdated = next !== raw;
    }

    let recordAdded = false;
    if (input.didWhat !== undefined) {
      const link = input.link ?? "";
      const duplicate = before.records.some(
        (record) => record.date === input.date && (record.didWhat === input.didWhat || (link !== "" && record.link === link)),
      );
      if (!duplicate) {
        next = addRecord(next, {
          date: input.date,
          didWhat: input.didWhat,
          link,
          linkText: input.linkText ?? "",
        });
        recordAdded = true;
      }
    }

    const overviewChanged = next !== raw;
    if (overviewChanged && !options.dryRun) await writeFile(this.overviewPath, next, "utf8");

    return options.dryRun
      ? { overviewChanged, progressUpdated, recordAdded, preview: next }
      : { overviewChanged, progressUpdated, recordAdded };
  }
}
