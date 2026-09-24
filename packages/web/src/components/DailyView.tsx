import { useCallback, useEffect, useRef, useState } from "react";
import type { CloseDayInput, CloseDayResult, SummaryDoc } from "@myblog/core";
import { closeDay, errorMessage, getSummary, saveSummary, scaffoldDay } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { revealStyle } from "../reveal.js";
import { DatePicker } from "./DatePicker.js";
import { Markdown } from "./Markdown.js";

interface Props {
  date: string;
  summaries: SummaryDoc[];
  onSelectDate: (date: string) => void;
  onRefresh: () => Promise<void>;
}

const SUMMARY_FILE = "SUMMARY.md";
const DATE_PAGE = 120;

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
  const [mode, setMode] = useState<"edit" | "split" | "preview">("edit");
  const [dateLimit, setDateLimit] = useState(DATE_PAGE);
  const [savedAt, setSavedAt] = useState("");

  const [editor, setEditor] = useState<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState<HTMLDivElement | null>(null);
  const syncSource = useRef<"editor" | "preview" | null>(null);

  useEffect(() => {
    if (mode !== "split" || !editor || !preview) return;

    const sync = (from: HTMLElement, to: HTMLElement, source: "editor" | "preview"): void => {
      if (syncSource.current && syncSource.current !== source) return;
      syncSource.current = source;
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      to.scrollTop = fromMax > 0 ? (from.scrollTop / fromMax) * toMax : 0;
      window.requestAnimationFrame(() => {
        if (syncSource.current === source) syncSource.current = null;
      });
    };

    const onEditor = (): void => sync(editor, preview, "editor");
    const onPreview = (): void => sync(preview, editor, "preview");
    editor.addEventListener("scroll", onEditor);
    preview.addEventListener("scroll", onPreview);
    return () => {
      editor.removeEventListener("scroll", onEditor);
      preview.removeEventListener("scroll", onPreview);
    };
  }, [mode, editor, preview]);

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

  const stamp = (): string => new Date().toLocaleTimeString().slice(0, 5);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await saveSummary(date, content);
          setDirty(false);
          setSavedAt(stamp());
          await onRefresh();
        } catch {
          // 自动保存失败：保持未保存状态，用户仍可手动保存
        }
      })();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [content, date, dirty, onRefresh]);

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const chooseDate = (target: string): void => {
    if (target === date) return;
    if (dirty) void saveSummary(date, content).catch(() => undefined);
    onSelectDate(target);
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

  const shown = summaries.slice(0, dateLimit);
  const dateGroups: { month: string; items: { summary: SummaryDoc; index: number }[] }[] = [];
  shown.forEach((summary, index) => {
    const month = summary.date.slice(0, 7);
    const last = dateGroups[dateGroups.length - 1];
    if (last && last.month === month) last.items.push({ summary, index });
    else dateGroups.push({ month, items: [{ summary, index }] });
  });

  return (
    <div className="daily">
      <aside className="date-side">
        <div className="date-list-head">
          <h2>日期</h2>
          <DatePicker value={date} onChange={chooseDate} />
        </div>
        <div className="date-list">
        {dateGroups.map((group) => (
          <div key={group.month} className="date-group">
            <span className="date-month">{group.month}</span>
            {group.items.map(({ summary, index }) => (
              <button
                key={summary.date}
                type="button"
                className={`date-item reveal${summary.date === date ? " active" : ""}`}
                style={revealStyle(index)}
                onClick={() => chooseDate(summary.date)}
              >
                <span className="date-num">{summary.date.slice(5)}</span>
                {summary.skills.length > 0 && <span className="date-skills">{summary.skills.join(" ")}</span>}
                <span className="date-preview">{summary.preview.split("\n")[0]}</span>
              </button>
            ))}
          </div>
        ))}
        {summaries.length === 0 && <p className="muted">还没有任何总结。</p>}
        {summaries.length > dateLimit && (
          <button type="button" className="ghost date-more" onClick={() => setDateLimit((value) => value + DATE_PAGE)}>
            显示更早的 {Math.min(summaries.length - dateLimit, DATE_PAGE)} 天
          </button>
        )}
        </div>
      </aside>

      <section className="card editor">
        <div className="card-head">
          <h2>{date || "选择日期"}</h2>
          <div className="row">
            {current && current.skills.length > 0 && <span className="chip">{current.skills.join(" ")}</span>}
            {!exists && date && <span className="chip">尚无总结</span>}
            {dirty && <span className="chip warn">未保存</span>}
            {!dirty && savedAt && <span className="muted">已保存 {savedAt}</span>}
          </div>
        </div>

        {loading ? (
          <p className="muted">读取中…</p>
        ) : (
          <>
            <div className="editor-toolbar">
              <div className="seg">
                {(
                  [
                    { id: "edit", label: "编辑" },
                    { id: "split", label: "分栏" },
                    { id: "preview", label: "预览" },
                  ] as { id: "edit" | "split" | "preview"; label: string }[]
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`seg-item${mode === option.id ? " active" : ""}`}
                    onClick={() => setMode(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={`editor-panes mode-${mode}`}>
              {mode !== "preview" && (
                <textarea
                  ref={setEditor}
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
              {mode !== "edit" && (
                <div className="markdown-preview" ref={setPreview}>
                  <Markdown>{content}</Markdown>
                </div>
              )}
            </div>
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
