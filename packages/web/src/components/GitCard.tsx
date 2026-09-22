import { useCallback, useEffect, useState } from "react";
import { commitGit, errorMessage, getGit, type GitState } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { IconGit } from "./icons.js";

interface Props {
  onCommitted: () => Promise<void> | void;
}

export function GitCard({ onCommitted }: Props) {
  const toast = useToast();
  const [state, setState] = useState<GitState | null>(null);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const next = await getGit();
      setState(next);
      setMessage(next.suggested);
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (): Promise<void> => {
    if (message.trim() === "") return;
    setBusy(true);
    try {
      await commitGit(message.trim());
      toast("success", "已提交");
      setOpen(false);
      await load();
      await onCommitted();
    } catch (caught) {
      toast("error", errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (state && !state.isRepo) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>版本</h2>
          <span className="chip">未启用</span>
        </div>
        <p className="muted">
          这个工作区还不是 git 仓库。在仓库根执行 <code className="code">git init</code> 后就能一键提交学习记录。
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>版本</h2>
        {state && (
          <span className="chip">
            <IconGit /> {state.branch}
          </span>
        )}
      </div>

      {!state && <p className="muted">读取 git 状态…</p>}
      {state && (
        <>
          <p className="muted">
            {state.dirty > 0 ? `${state.dirty} 处改动未提交` : "工作区干净，没有需要提交的改动"}
          </p>
          {state.lastCommit && <p className="muted mono-line">最近：{state.lastCommit}</p>}
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={state.dirty === 0}
              onClick={() => {
                setMessage(state.suggested);
                setOpen(true);
              }}
            >
              提交学习仓
            </button>
            <button type="button" onClick={() => void load()}>
              刷新
            </button>
          </div>
        </>
      )}

      {open && (
        <div className="palette-overlay" onClick={() => setOpen(false)}>
          <div className="palette dialog" onClick={(event) => event.stopPropagation()}>
            <div className="palette-input">
              <strong>提交学习仓</strong>
            </div>
            <div className="dialog-body">
              <p className="muted">
                会执行 <code className="code">git add -A</code> 并提交以下信息：
              </p>
              <input
                autoFocus
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                  if (event.key === "Escape") setOpen(false);
                }}
                placeholder="提交信息"
              />
              <div className="row">
                <button type="button" className="primary" disabled={busy || message.trim() === ""} onClick={() => void submit()}>
                  {busy ? "提交中…" : "提交"}
                </button>
                <button type="button" onClick={() => setOpen(false)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
