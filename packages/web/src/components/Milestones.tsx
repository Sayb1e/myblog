import type { CapabilityStatus } from "@myblog/core";
import { computeAchievements } from "../achievements.js";
import { IconCheck } from "./icons.js";

interface Props {
  summaryCount: number;
  currentStreak: number;
  capabilities: CapabilityStatus[];
  chatted: boolean;
}

export function Milestones({ summaryCount, currentStreak, capabilities, chatted }: Props) {
  const items = computeAchievements({ summaryCount, currentStreak, capabilities, chatted });
  const done = items.filter((item) => item.done).length;

  return (
    <section className="card milestones-card">
      <div className="card-head">
        <h2>成就</h2>
        <span className="muted">{done}/{items.length}</span>
      </div>
      <ul className="milestone-list">
        {items.map((item) => (
          <li key={item.id} className={`milestone${item.done ? " done" : ""}`}>
            <span className="milestone-mark">{item.done ? <IconCheck /> : <span className="milestone-dot" />}</span>
            <span className="milestone-label">{item.label}</span>
            {item.hint && <span className="milestone-hint">{item.hint}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
