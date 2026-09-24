import type { CapabilityStatus } from "@myblog/core";
import { IconCheck } from "./icons.js";

interface Props {
  summaryCount: number;
  currentStreak: number;
  capabilities: CapabilityStatus[];
  chatted: boolean;
}

const CLOSED = /已闭环|已通|已完成|闭环/;

interface Milestone {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

export function Milestones({ summaryCount, currentStreak, capabilities, chatted }: Props) {
  const closed = capabilities.filter((capability) => CLOSED.test(capability.status)).length;
  const at = (value: number, target: number): string => `${Math.min(value, target)}/${target}`;

  const items: Milestone[] = [
    { id: "note-1", label: "写下第一篇总结", done: summaryCount >= 1, hint: summaryCount >= 1 ? undefined : at(summaryCount, 1) },
    { id: "note-5", label: "累计 5 篇总结", done: summaryCount >= 5, hint: summaryCount >= 5 ? undefined : at(summaryCount, 5) },
    { id: "note-20", label: "累计 20 篇总结", done: summaryCount >= 20, hint: summaryCount >= 20 ? undefined : at(summaryCount, 20) },
    { id: "streak-3", label: "连续学习 3 天", done: currentStreak >= 3, hint: currentStreak >= 3 ? undefined : at(currentStreak, 3) },
    { id: "streak-7", label: "连续学习 7 天", done: currentStreak >= 7, hint: currentStreak >= 7 ? undefined : at(currentStreak, 7) },
    { id: "streak-30", label: "连续学习 30 天", done: currentStreak >= 30, hint: currentStreak >= 30 ? undefined : at(currentStreak, 30) },
    { id: "g-1", label: "闭环第一个能力（G）", done: closed >= 1, hint: closed >= 1 ? undefined : at(closed, 1) },
    { id: "g-5", label: "闭环 5 个能力", done: closed >= 5, hint: closed >= 5 ? undefined : at(closed, 5) },
    { id: "chat-1", label: "第一次用 AI 规划", done: chatted },
  ];

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
