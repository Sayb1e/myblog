import type { Capability, GoalsDoc } from "./goals.js";
import type { LearningRecord, OverviewDoc, ProgressSnapshot } from "./overview.js";
import type { SummaryDoc } from "./daily.js";

export interface CapabilityStatus extends Capability {
  active: boolean;
}

export interface WorkspaceStatus {
  stage: string;
  stageIds: string[];
  capabilities: CapabilityStatus[];
  progress: ProgressSnapshot;
  records: LearningRecord[];
  directions: string[];
}

export interface TodayPlan {
  stage: string;
  stageIds: string[];
  active: CapabilityStatus[];
  next: string;
  lastDate: string;
  lastNext: string;
  lastSkills: string[];
}

export function activeSkillIds(goals: GoalsDoc): string[] {
  return goals.stageIds;
}

export function buildPlan(status: WorkspaceStatus, lastSummary?: SummaryDoc | null): TodayPlan {
  return {
    stage: status.stage,
    stageIds: status.stageIds,
    active: status.capabilities.filter((capability) => capability.active),
    next: status.progress.next,
    lastDate: lastSummary?.date ?? status.records[0]?.date ?? "",
    lastNext: lastSummary?.next ?? "",
    lastSkills: lastSummary?.skills ?? [],
  };
}

export function buildStatus(overview: OverviewDoc, goals: GoalsDoc): WorkspaceStatus {
  const stageIds = activeSkillIds(goals);
  return {
    stage: goals.currentStage,
    stageIds,
    capabilities: goals.capabilities.map((capability) => ({
      ...capability,
      active: stageIds.includes(capability.id),
    })),
    progress: overview.progress,
    records: overview.records,
    directions: overview.directions,
  };
}
