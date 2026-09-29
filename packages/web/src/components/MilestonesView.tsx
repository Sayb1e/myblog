import type { Achievement } from "../achievements.js";
import { ActivityHeatmap } from "./ActivityHeatmap.js";
import { LearningCurve } from "./LearningCurve.js";
import { Milestones } from "./Milestones.js";

interface Props {
  activity: Map<string, number>;
  achievements: Achievement[];
  /** 参与统计的学习库数量（>1 时提示已跨库合并） */
  libCount?: number;
}

export function MilestonesView({ activity, achievements, libCount }: Props) {
  return (
    <div className="milestones-view">
      <Milestones achievements={achievements} />
      <ActivityHeatmap activity={activity} />
      <LearningCurve activity={activity} />
      {(libCount ?? 0) > 1 && (
        <p className="muted milestones-scope">热力图 / 学习曲线 / 成就已合并全部 {libCount} 个学习库的进展。</p>
      )}
    </div>
  );
}
