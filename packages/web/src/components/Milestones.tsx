import { useState } from "react";
import { createPortal } from "react-dom";
import { readAchievementTimes, type Achievement } from "../achievements.js";
import { AchievementDetail, AchievementTile } from "./AchievementParts.js";
import { AchievementWall } from "./AchievementWall.js";
import { Modal } from "./Modal.js";

interface Props {
  achievements: Achievement[];
}

export function Milestones({ achievements }: Props) {
  const [wallOpen, setWallOpen] = useState(false);
  const [selected, setSelected] = useState<Achievement | null>(null);

  const done = achievements.filter((item) => item.done).length;
  const times = readAchievementTimes();

  return (
    <section className="card milestones-card">
      <div className="card-head">
        <h2>成就</h2>
        <span className="muted">
          已解锁 {done}/{achievements.length}
        </span>
      </div>
      <div className="ach-progress" aria-hidden="true">
        <i style={{ width: `${(done / achievements.length) * 100}%` }} />
      </div>

      <ul className="ach-grid">
        {achievements.map((item) => (
          <li key={item.id}>
            <AchievementTile item={item} onClick={() => setSelected(item)} />
          </li>
        ))}
      </ul>

      <div className="ach-wall-entry">
        <button type="button" className="btn-sm" onClick={() => setWallOpen(true)}>
          全部成就 · {achievements.length}
        </button>
      </div>

      <AchievementWall
        open={wallOpen}
        achievements={achievements}
        onClose={() => setWallOpen(false)}
        onSelect={setSelected}
      />

      {createPortal(
        <Modal open={selected !== null} title="成就详情" onClose={() => setSelected(null)} className="ach-modal" centered>
          {selected && <AchievementDetail item={selected} times={times} />}
        </Modal>,
        document.body,
      )}
    </section>
  );
}
