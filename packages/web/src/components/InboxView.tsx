import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  deleteInboxFile,
  errorMessage,
  getInboxList,
  readInboxFile,
  renameInboxFile,
  writeInboxFile,
} from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { MarkdownLiveEditor } from "./MarkdownLiveEditor.js";
import { Modal } from "./Modal.js";
import { Select } from "./Select.js";

interface Note {
  name: string;
  updatedAt: number;
  bytes: number;
}

type Mode = "source" | "edit";

const MODES: { id: Mode; label: string }[] = [
  { id: "source", label: "源码模式" },
  { id: "edit", label: "编辑模式" },
];

function timeName(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.md`;
}

export function InboxView() {
  const toast = useToast();
  const [dir, setDir] = useState("");
  const [files, setFiles] = useState<Note[]>([]);
  const [current, setCurrent] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<Mode>("edit");
  const [savedAt, setSavedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const contentRef = useRef("");
  contentRef.current = content;
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ name: string; value: string } | null>(null);

  const refreshList = useCallback(async (): Promise<{ dir: string; today: string; files: Note[] } | null> => {
    try {
      const view = await getInboxList();
      setDir(view.dir);
      setFiles(view.files);
      return view;
    } catch (caught) {
      toast("error", errorMessage(caught));
      return null;
    }
  }, [toast]);

  const save = useCallback(
    async (name: string, value: string): Promise<void> => {
      if (name === "") return;
      setSaving(true);
      try {
        await writeInboxFile(name, value);
        setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
        void refreshList();
      } catch (caught) {
        toast("error", errorMessage(caught));
      } finally {
        setSaving(false);
      }
    },
    [refreshList, toast],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      await save(pending.name, pending.value);
    }
  }, [save]);

  const openFile = useCallback(
    async (name: string): Promise<void> => {
      await flush();
      try {
        const view = await readInboxFile(name);
        setCurrent(view.name);
        setContent(view.content && view.content.trim() !== "" ? view.content : `# ${name.replace(/\.md$/i, "")}\n\n`);
        setSavedAt("");
      } catch (caught) {
        toast("error", errorMessage(caught));
      }
    },
    [flush, toast],
  );

  useEffect(() => {
    void (async () => {
      const view = await refreshList();
      if (!view) return;
      const hasToday = view.files.some((file) => file.name === view.today);
      await openFile(hasToday ? view.today : view.files[0]?.name ?? view.today);
    })();
  }, [refreshList, openFile]);

  const onChange = (value: string): void => {
    setContent(value);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const pending = { name: current, value };
    pendingRef.current = pending;
    timerRef.current = window.setTimeout(() => {
      if (pendingRef.current === pending) {
        pendingRef.current = null;
        void save(pending.name, pending.value);
      }
    }, 1200);
  };

  const newNote = async (): Promise<void> => {
    await flush();
    const name = timeName();
    await save(name, `# ${name.replace(/\.md$/i, "")}\n\n`);
    await openFile(name);
  };

  const submitRename = async (): Promise<void> => {
    const raw = renameValue.trim();
    if (raw === "" || raw === current) {
      setRenameOpen(false);
      return;
    }
    const to = /\.md$/i.test(raw) ? raw : `${raw}.md`;
    try {
      await renameInboxFile(current, to);
      setRenameOpen(false);
      await refreshList();
      await openFile(to);
      toast("success", "已重命名");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const submitDelete = async (): Promise<void> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    try {
      await deleteInboxFile(current);
      setDeleteOpen(false);
      const view = await refreshList();
      setCurrent("");
      setContent("");
      await openFile(view?.files[0]?.name ?? timeName());
      toast("info", "已删除");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const visibleFiles =
    filter.trim() === ""
      ? files
      : files.filter((file) => file.name.toLowerCase().includes(filter.trim().toLowerCase()));

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <div className="card inbox-card">
      <div className="card-head">
        <h2>收获收件箱</h2>
        <span className="muted">
          {saving ? "保存中…" : savedAt ? `已保存 ${savedAt}` : "计划外学到的东西，随手写这里"}
        </span>
      </div>
      <p className="muted inbox-path">
        {dir || "（路径见 设置 → 存储）"}
      </p>
      <div className="inbox-wrap">
        <div className="inbox-side">
          <button type="button" className="btn-sm" onClick={() => void newNote()}>
            ＋ 新建笔记
          </button>
          <input
            className="inbox-filter"
            value={filter}
            spellCheck={false}
            placeholder="过滤文件名…"
            onChange={(event) => setFilter(event.target.value)}
          />
          <ul className="inbox-list">
            {visibleFiles.map((file) => (
              <li key={file.name}>
                <button
                  type="button"
                  className={`inbox-note${file.name === current ? " active" : ""}`}
                  onClick={() => void openFile(file.name)}
                >
                  {file.name}
                </button>
              </li>
            ))}
            {visibleFiles.length === 0 && (
              <li className="muted inbox-empty">
                {files.length === 0 ? "还没有笔记，点「新建笔记」开始" : "没有匹配的笔记"}
              </li>
            )}
          </ul>
        </div>

        <div className="inbox-main">
          <div className="inbox-files-bar">
            <Select
              className="inbox-select"
              value={current}
              options={visibleFiles.map((file) => ({ value: file.name, label: file.name }))}
              onChange={(value) => void openFile(value)}
              placeholder={current || "选择笔记"}
            />
            <button type="button" className="btn-sm" onClick={() => void newNote()}>
              ＋ 新建
            </button>
          </div>
          <div className="inbox-toolbar">
            <div className="inbox-toolbar-left">
              <div className="seg">
                {MODES.map((option) => (
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
              <button
                type="button"
                className="btn-sm"
                disabled={!current}
                onClick={() => {
                  setRenameValue(current.replace(/\.md$/i, ""));
                  setRenameOpen(true);
                }}
              >
                重命名
              </button>
              <button type="button" className="btn-sm" disabled={!current} onClick={() => setDeleteOpen(true)}>
                删除
              </button>
            </div>
            <span className="muted">
              {current || "—"} · 约 1.2 秒自动保存 · Ctrl+S
            </span>
          </div>
          <div className={`inbox-panes mode-${mode}`}>
            {mode === "source" ? (
              <textarea
                className="inbox-editor"
                value={content}
                spellCheck={false}
                placeholder="随手记：学到了什么、从哪来的；背景的点子、没进计划的都行。"
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    void save(current, contentRef.current);
                  }
                }}
              />
            ) : (
              <MarkdownLiveEditor key={current} value={content} onChange={onChange} />
            )}
          </div>
        </div>
      </div>

      {createPortal(
        <>
          <Modal open={renameOpen} className="dialog" title="重命名笔记" onClose={() => setRenameOpen(false)}>
            <div className="dialog-body">
              <input
                data-autofocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitRename();
                }}
              />
              <div className="row">
                <button type="button" className="primary" onClick={() => void submitRename()}>
                  确定
                </button>
                <button type="button" onClick={() => setRenameOpen(false)}>
                  取消
                </button>
              </div>
            </div>
          </Modal>

          <Modal open={deleteOpen} className="dialog" title="删除笔记" onClose={() => setDeleteOpen(false)}>
            <div className="dialog-body">
              <p className="muted">删除后不可撤销，确定删除「{current}」吗？</p>
              <div className="row">
                <button type="button" className="primary danger" onClick={() => void submitDelete()}>
                  删除
                </button>
                <button type="button" onClick={() => setDeleteOpen(false)}>
                  取消
                </button>
              </div>
            </div>
          </Modal>
        </>,
        document.body,
      )}
    </div>
  );
}
