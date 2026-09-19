import type { TodayPlan } from "@myblog/core";
import { Markdown } from "./Markdown.js";

interface Props {
  plan: TodayPlan;
  onOpenDate: (date: string) => void;
}

export function TodayCard({ plan, onOpenDate }: Props) {
  return (
    <section className="card today-card">
      <div className="card-head">
        <h2>今天该干什么</h2>
        <div className="chips">
          {plan.active.map((capability) => (
            <span key={capability.id} className="chip accent">
              {capability.id} {capability.name}
            </span>
          ))}
          {plan.active.length === 0 && <span className="muted">没有活跃能力编号</span>}
        </div>
      </div>

      <div className="lead">
        {plan.next ? <Markdown>{plan.next}</Markdown> : <span className="muted">（总览里还没写「下次从哪继续」）</span>}
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
    </section>
  );
}
