import type { Achievement } from "../achievements.js";
import { ActivityHeatmap } from "./ActivityHeatmap.js";
import { LearningCurve } from "./LearningCurve.js";
import { Milestones } from "./Milestones.js";

interface Props {
  activity: Map<string, number>;
  achievements: Achievement[];
  /** 参与统计的学习库数量（>1 时提示已跨库合并） */
  libCount?: number;
  /** 点击热力图某天时回调 */
  onSelectDate?: (date: string) => void;
}

export function MilestonesView({ activity, achievements, libCount, onSelectDate }: Props) {
  return (
    <div className="milestones-view">
      <Milestones achievements={achievements} />
      <section className="card milestones-charts">
        <ActivityHeatmap activity={activity} bare onSelectDate={onSelectDate} />
        <LearningCurve activity={activity} bare />
      </section>
      {(libCount ?? 0) > 1 && (
        <p className="muted milestones-scope">热力图 / 学习曲线 / 成就已合并全部 {libCount} 个学习库的进展。</p>
      )}
    </div>
  );
}
