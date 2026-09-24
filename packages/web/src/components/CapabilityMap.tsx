import { Fragment, useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { CapabilityStatus } from "@myblog/core";
import { revealStyle } from "../reveal.js";
import { Markdown } from "./Markdown.js";

interface Props {
  capabilities: CapabilityStatus[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onSaveStatus: (id: string, status: string) => Promise<void>;
  onInit?: () => void;
  onDraftGoals?: () => void;
  /** 日期 -> 该天涉及的 G 编号，用于显示每个能力的真实活跃度 */
  history?: Map<string, string[]>;
}

const PRESETS = ["未开始", "进行中", "已闭环", "已通"];
const LIMIT = 12;

function level(status: string): 0 | 1 | 2 {
  if (/已闭环|已通|已完成|闭环/.test(status)) return 2;
  if (/未开始|未备|未做/.test(status)) return 0;
  return 1;
}

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** 每个能力四个维度的进度条：掌握（状态）/ 投入（出现天数）/ 持续（时间跨度）/ 热度（最近程度） */
function params(status: string, used: { count: number; first: string; last: string } | undefined) {
  const mastery = level(status);
  const count = used?.count ?? 0;
  const first = used?.first ?? "";
  const last = used?.last ?? "";
  return [
    { key: "mastery", label: "掌握", ratio: mastery === 2 ? 1 : mastery === 1 ? 0.55 : 0.08, tip: `状态：${status || "未填"}` },
    { key: "volume", label: "投入", ratio: clamp01(count / 10), tip: count > 0 ? `学习记录里出现 ${count} 天` : "还没出现在学习记录里" },
    { key: "span", label: "持续", ratio: first && last ? clamp01((daysBetween(first, last) + 1) / 30) : 0, tip: first ? `${first} → ${last}` : "还没有记录" },
    { key: "recency", label: "热度", ratio: last ? clamp01(1 - daysBetween(last, todayString()) / 60) : 0, tip: last ? `最近 ${last}` : "还没有记录" },
  ];
}

export function CapabilityMap({
  capabilities,
  selected,
  onSelect,
  onSaveStatus,
  onInit,
  onDraftGoals,
  history,
}: Props) {
  const usage = useMemo(() => {
    const map = new Map<string, { count: number; first: string; last: string }>();
    for (const [date, ids] of history ?? []) {
      for (const id of ids) {
        const entry = map.get(id) ?? { count: 0, first: "", last: "" };
        entry.count += 1;
        if (entry.first === "" || date < entry.first) entry.first = date;
        if (date > entry.last) entry.last = date;
        map.set(id, entry);
      }
    }
    return map;
  }, [history]);

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
        {(onInit || onDraftGoals) && (
          <div className="row">
            {onDraftGoals && (
              <button type="button" className="primary" onClick={onDraftGoals}>
                用模型生成学习目标
              </button>
            )}
            {onInit && (
              <button type="button" onClick={onInit}>
                用默认模板
              </button>
            )}
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
      </div>
      <p className="muted">
        <Markdown inline>{capability.question}</Markdown>
      </p>
      <p className="muted cap-detail-usage">
        {usage.get(capability.id)
          ? `学习记录里出现 ${usage.get(capability.id)?.count} 天，最近 ${usage.get(capability.id)?.last}`
          : "学习记录里还没出现"}
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
        {onDraftGoals && (
          <button type="button" className="ghost btn-sm" onClick={onDraftGoals} data-tip="用模型按你的想法重写 GOALS.md">
            生成 / 更新目标…
          </button>
        )}
      </div>

      <ul className={`capabilities${capped && !expanded ? " capped" : ""}`}>
        {capabilities.map((entry, index) => {
          const used = usage.get(entry.id);
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
                  <span className="cap-row cap-row-main">
                    <span className="cap-id">{entry.id}</span>
                    <span className="cap-name">
                      {entry.name}
                      {entry.active && <span className="tag">当前</span>}
                    </span>
                    <span className="cap-status">
                      <Markdown inline>{entry.status}</Markdown>
                    </span>
                  </span>
                  <span className="cap-row cap-row-progress">
                    {params(entry.status, used).map((param) => (
                      <span key={param.key} className="cap-param" title={param.tip}>
                        <span className="cap-param-label">{param.label}</span>
                        <span className="cap-param-bar">
                          <i style={{ width: `${Math.round(param.ratio * 100)}%` }} />
                        </span>
                      </span>
                    ))}
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
