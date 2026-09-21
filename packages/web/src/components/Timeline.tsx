import type { LearningRecord } from "@myblog/core";
import { revealStyle } from "../reveal.js";
import { Markdown } from "./Markdown.js";

interface Props {
  records: LearningRecord[];
  skillsByDate: Map<string, string[]>;
  skill: string | null;
  onOpen: (date: string) => void;
}

export function Timeline({ records, skillsByDate, skill, onOpen }: Props) {
  const visible = skill ? records.filter((record) => skillsByDate.get(record.date)?.includes(skill)) : records;

  return (
    <section className="card">
      <div className="card-head">
        <h2>时间线</h2>
        {skill && <span className="chip">筛选 {skill}</span>}
      </div>

      {visible.length === 0 && <p className="muted">没有记录。</p>}

      <ol className="timeline">
        {visible.map((record, index) => (
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
                {record.link && <span className="tl-link">{record.link}</span>}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
