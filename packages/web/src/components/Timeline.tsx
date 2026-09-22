import { useEffect, useState } from "react";
import type { LearningRecord } from "@myblog/core";
import { revealStyle } from "../reveal.js";
import { Markdown } from "./Markdown.js";

interface Props {
  records: LearningRecord[];
  skillsByDate: Map<string, string[]>;
  skill: string | null;
  onOpen: (date: string) => void;
}

const PAGE = 120;

export function Timeline({ records, skillsByDate, skill, onOpen }: Props) {
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    setLimit(PAGE);
  }, [skill]);

  const matched = skill ? records.filter((record) => skillsByDate.get(record.date)?.includes(skill)) : records;
  const visible = matched.slice(0, limit);
  const remaining = matched.length - visible.length;

  const groups: { month: string; items: { record: LearningRecord; index: number }[] }[] = [];
  visible.forEach((record, index) => {
    const month = record.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push({ record, index });
    else groups.push({ month, items: [{ record, index }] });
  });

  return (
    <section className="card">
      <div className="card-head">
        <h2>时间线</h2>
        {skill && <span className="chip">筛选 {skill}</span>}
        {matched.length > PAGE && <span className="muted">共 {matched.length} 条</span>}
      </div>

      {matched.length === 0 && <p className="muted">没有记录。</p>}

      <ol className="timeline">
        {groups.map((group) => (
          <li key={group.month} className="tl-group">
            <span className="tl-month">{group.month}</span>
            <ol className="timeline">
              {group.items.map(({ record, index }) => (
                <li key={`${record.date}-${index}`} className="reveal" style={revealStyle(index)}>
                  <div
                    className="tl-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(record.date)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(record.date);
                      }
                    }}
                  >
                    <span className="tl-dot" />
                    <span className="tl-date">{record.date}</span>
                    <span className="tl-body">
                      <Markdown inline>{record.didWhat}</Markdown>
                      <span className="tl-tags">
                        {(skillsByDate.get(record.date) ?? []).map((id) => (
                          <span key={id} className="tl-tag">
                            {id}
                          </span>
                        ))}
                        {record.link && <span className="tl-link">{record.link}</span>}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {remaining > 0 && (
        <div className="row">
          <button type="button" onClick={() => setLimit((current) => current + PAGE)}>
            显示更早的 {Math.min(remaining, PAGE)} 条
          </button>
        </div>
      )}
    </section>
  );
}
