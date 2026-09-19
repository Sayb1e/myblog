import { useCallback, useEffect, useState } from "react";
import type { CloseDayInput, CloseDayResult, SummaryDoc } from "@myblog/core";
import { closeDay, errorMessage, getSummary, saveSummary, scaffoldDay } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { Markdown } from "./Markdown.js";

interface Props {
  date: string;
  summaries: SummaryDoc[];
  onSelectDate: (date: string) => void;
  onRefresh: () => Promise<void>;
}

const SUMMARY_FILE = "总结.md";

export function DailyView({ date, summaries, onSelectDate, onRefresh }: Props) {
  const toast = useToast();
  const [content, setContent] = useState("");
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [learned, setLearned] = useState("");
  const [next, setNext] = useState("");
  const [did, setDid] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [closePreview, setClosePreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(
    async (target: string) => {
      if (!target) return;
      setLoading(true);
      try {
        const result = await getSummary(target);
        setExists(result.exists);
        setContent(result.exists && result.summary ? result.summary.raw : "");
        setDirty(false);
      } catch (caught) {
        toast("error", errorMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const save = async (): Promise<void> => {
    try {
      await saveSummary(date, content);
      setDirty(false);
      toast("success", "总结已保存");
      await onRefresh();
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const create = async (): Promise<void> => {
    try {
      const result = await scaffoldDay(date);
      toast("info", result.created ? "已新建当日总结" : "已存在，未覆盖");
      await load(date);
      await onRefresh();
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const runClose = async (): Promise<void> => {
    const payload: CloseDayInput & { dryRun?: boolean } = { date, dryRun };
    if (learned) payload.learned = learned;
    if (next) payload.next = next;
    if (did) {
      payload.didWhat = did;
      payload.link = `./${date}/${SUMMARY_FILE}`;
      payload.linkText = "总结";
    }
    try {
      const result: CloseDayResult = await closeDay(payload);
      if (dryRun) {
        setClosePreview(result.preview ?? "总览没有变化");
        toast("info", "已生成预览，未写盘");
      } else {
        setClosePreview("");
        toast("success", result.overviewChanged ? "已写回总览" : "总览没有变化");
        await onRefresh();
      }
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const current = summaries.find((summary) => summary.date === date);

  return (
    <div className="daily">
      <aside className="date-list">
        <div className="date-list-head">
          <h2>日期</h2>
          <input
            type="date"
            value={date}
            onChange={(event) => onSelectDate(event.target.value)}
            className="date-picker"
          />
        </div>
        {summaries.map((summary) => (
          <button
            key={summary.date}
            type="button"
            className={`date-item${summary.date === date ? " active" : ""}`}
            onClick={() => onSelectDate(summary.date)}
          >
            <span className="date-num">{summary.date}</span>
            {summary.skills.length > 0 && <span className="date-skills">{summary.skills.join(" ")}</span>}
            <span className="date-preview">{summary.preview.split("\n")[0]}</span>
          </button>
        ))}
        {summaries.length === 0 && <p className="muted">还没有任何总结。</p>}
      </aside>

      <section className="card editor">
        <div className="card-head">
          <h2>{date || "选择日期"}</h2>
          <div className="row">
            {current && current.skills.length > 0 && <span className="chip">{current.skills.join(" ")}</span>}
            {!exists && date && <span className="chip">尚无总结</span>}
            {dirty && <span className="chip warn">未保存</span>}
          </div>
        </div>

        {loading ? (
          <p className="muted">读取中…</p>
        ) : (
          <>
            <div className="editor-toolbar">
              <button
                type="button"
                className={showPreview ? "" : "active"}
                onClick={() => setShowPreview(false)}
              >
                编辑
              </button>
              <button type="button" className={showPreview ? "active" : ""} onClick={() => setShowPreview(true)}>
                预览
              </button>
            </div>
            {showPreview ? (
              <div className="markdown-preview">
                <Markdown>{content}</Markdown>
              </div>
            ) : (
              <textarea
                className="editor-area"
                value={content}
                spellCheck={false}
                placeholder={exists ? "" : "这一天还没有总结，点「新建当日总结」生成骨架，或直接在这里写。"}
                onChange={(event) => {
                  setContent(event.target.value);
                  setDirty(true);
                }}
              />
            )}
          </>
        )}

        <div className="row">
          <button type="button" className="primary" disabled={!dirty || loading} onClick={() => void save()}>
            保存
          </button>
          <button type="button" onClick={() => void create()}>
            新建当日总结
          </button>
          {dirty && <span className="muted">有未保存的修改</span>}
        </div>

        <details className="close-panel">
          <summary>收工写回总览</summary>
          <div className="close-form">
            <label>
              学到哪了
              <input value={learned} onChange={(event) => setLearned(event.target.value)} placeholder="留空则不改" />
            </label>
            <label>
              下次从哪继续
              <input value={next} onChange={(event) => setNext(event.target.value)} placeholder="留空则不改" />
            </label>
            <label>
              这次做了什么
              <input value={did} onChange={(event) => setDid(event.target.value)} placeholder="填了才加学习记录" />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
              只预览，不写盘
            </label>
            <button type="button" className="primary" onClick={() => void runClose()}>
              执行
            </button>
          </div>
          {closePreview && <pre className="preview">{closePreview}</pre>}
        </details>
      </section>
    </div>
  );
}
