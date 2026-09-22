import { Fragment, useEffect, useState, type ChangeEvent } from "react";
import type { CapabilityStatus } from "@myblog/core";
import { revealStyle } from "../reveal.js";
import { Markdown } from "./Markdown.js";

interface Props {
  capabilities: CapabilityStatus[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onSaveStatus: (id: string, status: string) => Promise<void>;
  onInit?: () => void;
}

const PRESETS = ["未开始", "进行中", "已闭环", "已通"];
const LIMIT = 12;

function level(status: string): 0 | 1 | 2 {
  if (/已闭环|已通|已完成|闭环/.test(status)) return 2;
  if (/未开始|未备|未做/.test(status)) return 0;
  return 1;
}

const PERCENT = [6, 55, 100] as const;

export function CapabilityMap({ capabilities, selected, onSelect, onSaveStatus, onInit }: Props) {
  const capability = capabilities.find((entry) => entry.id === selected) ?? null;
  const capped = capabilities.length > LIMIT;
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [capabilities.length]);

  useEffect(() => {
    setStatus(capability?.status ?? "");
  }, [capability?.id, capability?.status]);

  const dirty = capability !== null && status.trim() !== "" && status.trim() !== capability.status;

  const save = async (): Promise<void> => {
    if (!capability || !dirty) return;
    setSaving(true);
    try {
      await onSaveStatus(capability.id, status.trim());
    } finally {
      setSaving(false);
    }
  };

  if (capabilities.length === 0) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>能力地图</h2>
          <span className="chip">可选</span>
        </div>
        <p className="muted">
          还没有能力地图。它来自工作区里的 <code className="code">GOALS.md</code> 的「能力编号」表格（编号 / 能力 /
          验证问题 / 当前状态）。没有它也能用：概览与每日总结照常工作，只是阶段与能力进度为空。
        </p>
        {onInit && (
          <div className="row">
            <button type="button" onClick={onInit}>
              生成 GOALS.md
            </button>
          </div>
        )}
      </section>
    );
  }

  const detail = capability ? (
    <div className="cap-detail">
      <div className="cap-detail-head">
        <strong>
          {capability.id} {capability.name}
        </strong>
        {capability.active && <span className="tag">当前</span>}
        <button type="button" className="ghost btn-sm cap-detail-close" onClick={() => onSelect(null)}>
          收起
        </button>
      </div>
      <p className="muted">
        <Markdown inline>{capability.question}</Markdown>
      </p>

      <label className="cap-status-edit">
        <span className="muted">当前状态</span>
        <input
          value={status}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setStatus(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
          }}
          placeholder="例如：进行中"
        />
        <button type="button" className="primary btn-sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? "保存中…" : "保存"}
        </button>
      </label>
      <div className="cap-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`chip clickable${status.trim() === preset ? " accent" : ""}`}
            onClick={() => setStatus(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <section className="card cap-card">
      <div className="card-head">
        <h2>能力地图</h2>
        <span className="muted">点击查看 / 改状态</span>
        {capped && (
          <button type="button" className="ghost btn-sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "收起" : `展开全部 ${capabilities.length}`}
          </button>
        )}
      </div>

      <ul className={`capabilities${capped && !expanded ? " capped" : ""}`}>
        {capabilities.map((entry, index) => {
          const stage = level(entry.status);
          const isActive = selected === entry.id;
          return (
            <Fragment key={entry.id}>
              <li className="reveal" style={revealStyle(index)}>
                <div
                  className={`capability${isActive ? " selected" : ""}${entry.active ? " current" : ""}`}
                  role="button"
                  tabIndex={0}
                  title={`${entry.id} ${entry.name} — ${entry.question}`}
                  onClick={() => onSelect(isActive ? null : entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(isActive ? null : entry.id);
                    }
                  }}
                >
                  <span className="cap-id">{entry.id}</span>
                  <span className="cap-name">
                    {entry.name}
                    {entry.active && <span className="tag">当前</span>}
                  </span>
                  <span className="cap-meter">
                    <span className={`cap-bar level-${stage}`}>
                      <i style={{ width: `${PERCENT[stage]}%` }} />
                    </span>
                    <span className="cap-percent">{PERCENT[stage]}%</span>
                  </span>
                  <span className="cap-status">
                    <Markdown inline>{entry.status}</Markdown>
                  </span>
                </div>
              </li>
              {isActive && <li className="cap-detail-row">{detail}</li>}
            </Fragment>
          );
        })}
      </ul>
    </section>
  );
}
