import type { SummaryDoc } from "./daily.js";
import { buildPlan, emptyStatus } from "./status.js";
import type { Workspace } from "./workspace.js";

export async function buildContext(workspace: Workspace) {
  const check = await workspace.check();
  const { initialized, status } = await workspace.readStatusSafe();
  const missing: string[] = [];
  if (!initialized) missing.push("overview");
  if (!(await workspace.hasGoals())) missing.push("goals");

  if (!initialized || !status) {
    return {
      root: workspace.root,
      initialized: false,
      stage: "",
      stageIds: [],
      active: [],
      next: "",
      lastDate: "",
      lastNext: "",
      lastSkills: [],
      progress: emptyStatus().progress,
      records: [],
      directions: [],
      capabilities: [],
      missing,
      check,
    };
  }

  const lastDate = status.records[0]?.date ?? "";
  if (!lastDate) missing.push("latest-summary");
  let lastSummary: SummaryDoc | null = null;
  if (lastDate) {
    try {
      lastSummary = await workspace.readSummary(lastDate);
    } catch {
      lastSummary = null;
    }
  }

  const plan = buildPlan(status, lastSummary, missing);

  return {
    root: workspace.root,
    initialized: true,
    ...plan,
    progress: status.progress,
    records: status.records,
    directions: status.directions,
    capabilities: status.capabilities,
    check,
  };
}

export type ContextBundle = Awaited<ReturnType<typeof buildContext>>;
