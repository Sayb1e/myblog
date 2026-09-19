import type { SummaryDoc } from "./daily.js";
import { buildPlan } from "./status.js";
import type { Workspace } from "./workspace.js";

export async function buildContext(workspace: Workspace) {
  const status = await workspace.readStatus();
  const check = await workspace.check();

  const lastDate = status.records[0]?.date ?? "";
  let lastSummary: SummaryDoc | null = null;
  if (lastDate) {
    try {
      lastSummary = await workspace.readSummary(lastDate);
    } catch {
      lastSummary = null;
    }
  }

  const plan = buildPlan(status, lastSummary);

  return {
    root: workspace.root,
    ...plan,
    progress: status.progress,
    records: status.records,
    directions: status.directions,
    capabilities: status.capabilities,
    check,
  };
}

export type ContextBundle = Awaited<ReturnType<typeof buildContext>>;
