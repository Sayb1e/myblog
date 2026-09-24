import { useState } from "react";
import { readAchievementTimes, type Achievement } from "../achievements.js";
import { IconCheck } from "./icons.js";

interface Props {
  achievements: Achievement[];
}

export function Milestones({ achievements }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const done = achievements.filter((item) => item.done).length;
  const times = readAchievementTimes();

  return (
    <section className="card milestones-card">
      <div className="card-head">
        <h2>成就</h2>
        <span className="muted">{done}/{achievements.length}</span>
      </div>
      <ul className="milestone-list">
        {achievements.map((item) => {
          const isOpen = open === item.id;
          return (
            <li key={item.id} className={`milestone${item.done ? " done" : ""}${isOpen ? " open" : ""}`}>
              <button type="button" className="milestone-row" onClick={() => setOpen(isOpen ? null : item.id)}>
                <span className="milestone-mark">{item.done ? <IconCheck /> : <span className="milestone-dot" />}</span>
                <span className="milestone-name">{item.name}</span>
                {!item.done && item.progress && <span className="milestone-hint">{item.progress}</span>}
              </button>
              {isOpen && (
                <div className="milestone-detail">
                  <p className="milestone-task">{item.task}</p>
                  <p className="muted">
                    {item.done
                      ? `已达成${times[item.id] ? ` · ${times[item.id]?.slice(0, 10) ?? ""}` : ""}`
                      : `进度：${item.progress ?? "—"}`}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
