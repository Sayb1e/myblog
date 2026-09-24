import type { TodayPlan } from "@myblog/core";
import { IconCommand } from "./icons.js";
import { Markdown } from "./Markdown.js";

interface Props {
  plan: TodayPlan;
  workspace: string;
  onOpenDate: (date: string) => void;
  onOpenPalette?: () => void;
  onInit?: () => void;
  onWriteToday?: () => void;
}

export function TodayCard({ plan, workspace, onOpenDate, onOpenPalette, onInit, onWriteToday }: Props) {
  const today = new Date();
  const dateLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  return (
    <section className="card today-card hero">
      <div className="hero-head">
        <div className="hero-title">
          <span className="hero-eyebrow">今日学习</span>
          <h2>{workspace || "学习工作区"}</h2>
        </div>
        <div className="hero-meta">
          <span className="chip accent">{dateLabel}</span>
          <span className="chip">{plan.stageIds.join(" · ") || "未识别阶段"}</span>
          {onWriteToday && (
            <button type="button" className="btn-sm hero-write" onClick={onWriteToday}>
              写今天
            </button>
          )}
          {onOpenPalette && (
            <button type="button" className="icon-btn sm hero-cmd" onClick={onOpenPalette} data-tip="命令面板 (Ctrl+K)">
              <IconCommand />
            </button>
          )}
        </div>
      </div>

      <div className="lead">
        {plan.next ? <Markdown>{plan.next}</Markdown> : <span className="muted">（总览里还没写「下次从哪继续」）</span>}
      </div>

      <div className="chips">
        {plan.active.map((capability) => (
          <span key={capability.id} className="chip accent">
            {capability.id} {capability.name}
          </span>
        ))}
        {plan.active.length === 0 && <span className="muted">没有活跃能力编号</span>}
      </div>

      {plan.lastDate && (
        <button type="button" className="last-summary" onClick={() => onOpenDate(plan.lastDate)}>
          <span className="muted">
            最近总结 {plan.lastDate}
            {plan.lastSkills.length > 0 ? ` · ${plan.lastSkills.join(" ")}` : ""}
          </span>
          <span className="last-next">
            <Markdown inline>{plan.lastNext.split("\n")[0] ?? ""}</Markdown>
          </span>
        </button>
      )}

      {plan.missing.length > 0 && (
        <div className="hero-hint">
          <span className="muted">
            {plan.missing.includes("goals")
              ? "未设置「GOALS.md」：规划只依据总览（阶段已从「下次从哪继续」推断）。"
              : "还没有任何每日总结。"}
          </span>
          {plan.missing.includes("goals") && onInit && (
            <button type="button" className="btn-sm" onClick={onInit}>
              生成学习目标
            </button>
          )}
        </div>
      )}
    </section>
  );
}
