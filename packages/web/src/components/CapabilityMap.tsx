import type { CapabilityStatus } from "@myblog/core";
import { Markdown } from "./Markdown.js";

interface Props {
  capabilities: CapabilityStatus[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

function level(status: string): 0 | 1 | 2 {
  if (/已闭环|已通|已完成|闭环/.test(status)) return 2;
  if (/未开始|未备|未做/.test(status)) return 0;
  return 1;
}

const PERCENT = [6, 55, 100] as const;

export function CapabilityMap({ capabilities, selected, onSelect }: Props) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>能力地图</h2>
        <span className="muted">点击筛选时间线</span>
      </div>

      <ul className="capabilities">
        {capabilities.map((capability) => {
          const stage = level(capability.status);
          const isActive = selected === capability.id;
          return (
            <li key={capability.id}>
              <div
                className={`capability${isActive ? " selected" : ""}${capability.active ? " current" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(isActive ? null : capability.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(isActive ? null : capability.id);
                  }
                }}
              >
                <span className="cap-id">{capability.id}</span>
                <span className="cap-body">
                  <span className="cap-name">
                    {capability.name}
                    {capability.active && <span className="tag">当前</span>}
                  </span>
                  <span className="cap-question">
                    <Markdown inline>{capability.question}</Markdown>
                  </span>
                  <span className={`cap-bar level-${stage}`}>
                    <i style={{ width: `${PERCENT[stage]}%` }} />
                  </span>
                  <span className="cap-status">
                    <Markdown inline>{capability.status}</Markdown>
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
