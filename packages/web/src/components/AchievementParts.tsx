import {
  RARITY_LABEL,
  progressRatio,
  progressText,
  type Achievement,
  type AchievementGroup,
} from "../achievements.js";
import { AchievementBadge } from "./AchievementBadge.js";

export type StatusFilter = "all" | "done" | "todo";

export const STATUS_LABELS: Record<StatusFilter, string> = { all: "全部", done: "已解锁", todo: "未解锁" };

interface FiltersProps {
  status: StatusFilter;
  group: AchievementGroup | "all";
  groups: AchievementGroup[];
  onStatus: (status: StatusFilter) => void;
  onGroup: (group: AchievementGroup | "all") => void;
}

export function AchievementFilters({ status, group, groups, onStatus, onGroup }: FiltersProps) {
  return (
    <div className="ach-filters">
      <div className="ach-seg" role="tablist" aria-label="按状态筛选">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={status === key}
            className={`ach-seg-btn${status === key ? " active" : ""}`}
            onClick={() => onStatus(key)}
          >
            {STATUS_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="ach-chips" role="tablist" aria-label="按分类筛选">
        <button
          type="button"
          role="tab"
          aria-selected={group === "all"}
          className={`ach-chip${group === "all" ? " active" : ""}`}
          onClick={() => onGroup("all")}
        >
          全部
        </button>
        {groups.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={group === entry}
            className={`ach-chip${group === entry ? " active" : ""}`}
            onClick={() => onGroup(entry)}
          >
            {entry}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TileProps {
  item: Achievement;
  onClick: () => void;
}

export function AchievementTile({ item, onClick }: TileProps) {
  return (
    <button
      type="button"
      className={`ach-tile rarity-${item.tier}${item.done ? " done" : ""}`}
      onClick={onClick}
    >
      <AchievementBadge icon={item.icon} tier={item.tier} done={item.done} ratio={progressRatio(item)} size={62} />
      <span className="ach-tile-name">{item.name}</span>
      <span className="ach-tile-sub">{progressText(item)}</span>
    </button>
  );
}

interface DetailProps {
  item: Achievement;
  times: Record<string, string>;
}

export function AchievementDetail({ item, times }: DetailProps) {
  return (
    <div className="ach-detail">
      <AchievementBadge icon={item.icon} tier={item.tier} done={item.done} ratio={progressRatio(item)} size={116} />
      <div className="ach-detail-head">
        <h3>{item.name}</h3>
        <span className={`ach-rarity rarity-${item.tier}`}>{RARITY_LABEL[item.tier]}</span>
      </div>
      <p className="ach-detail-task">{item.task}</p>
      <div className="ach-detail-bar" aria-hidden="true">
        <i className={`rarity-${item.tier}`} style={{ width: `${progressRatio(item) * 100}%` }} />
      </div>
      <p className="ach-detail-meta">
        {item.done
          ? `已达成${times[item.id] ? ` · ${times[item.id]?.slice(0, 10) ?? ""}` : ""}`
          : `进度：${progressText(item)}`}
      </p>
    </div>
  );
}
