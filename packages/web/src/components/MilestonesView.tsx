import type { CapabilityStatus } from "@myblog/core";
import { ActivityHeatmap } from "./ActivityHeatmap.js";
import { LearningCurve } from "./LearningCurve.js";
import { Milestones } from "./Milestones.js";

interface Props {
  activity: Map<string, number>;
  summaryCount: number;
  currentStreak: number;
  capabilities: CapabilityStatus[];
  chatted: boolean;
}

export function MilestonesView({ activity, summaryCount, currentStreak, capabilities, chatted }: Props) {
  return (
    <div className="milestones-view">
      <ActivityHeatmap activity={activity} />
      <LearningCurve activity={activity} />
      <Milestones
        summaryCount={summaryCount}
        currentStreak={currentStreak}
        capabilities={capabilities}
        chatted={chatted}
      />
    </div>
  );
}
