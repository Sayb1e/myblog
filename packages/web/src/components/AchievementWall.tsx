import { useState } from "react";
import { createPortal } from "react-dom";
import { GROUP_ORDER, type Achievement, type AchievementGroup } from "../achievements.js";
import { AchievementFilters, AchievementTile, type StatusFilter } from "./AchievementParts.js";
import { Modal } from "./Modal.js";

interface Props {
  open: boolean;
  achievements: Achievement[];
  onClose: () => void;
  onSelect: (item: Achievement) => void;
}

export function AchievementWall({ open, achievements, onClose, onSelect }: Props) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [group, setGroup] = useState<AchievementGroup | "all">("all");

  const groups = GROUP_ORDER.filter((entry) => achievements.some((item) => item.group === entry));
  const visible = achievements.filter((item) => {
    if (group !== "all" && item.group !== group) return false;
    if (status === "done" && !item.done) return false;
    if (status === "todo" && item.done) return false;
    return true;
  });

  return createPortal(
    <Modal open={open} title="全部成就" onClose={onClose} className="ach-wall-modal" centered>
      <div className="ach-wall">
        <AchievementFilters status={status} group={group} groups={groups} onStatus={setStatus} onGroup={setGroup} />
        {visible.length === 0 ? (
          <p className="muted ach-empty">这里还没有成就</p>
        ) : (
          <ul className="ach-wall-grid">
            {visible.map((item) => (
              <li key={item.id}>
                <AchievementTile item={item} onClick={() => onSelect(item)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>,
    document.body,
  );
}
