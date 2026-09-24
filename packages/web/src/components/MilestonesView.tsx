import type { Achievement } from "../achievements.js";
import { ActivityHeatmap } from "./ActivityHeatmap.js";
import { LearningCurve } from "./LearningCurve.js";
import { Milestones } from "./Milestones.js";

interface Props {
  activity: Map<string, number>;
  achievements: Achievement[];
}

export function MilestonesView({ activity, achievements }: Props) {
  return (
    <div className="milestones-view">
      <ActivityHeatmap activity={activity} />
      <LearningCurve activity={activity} />
      <Milestones achievements={achievements} />
    </div>
  );
}
