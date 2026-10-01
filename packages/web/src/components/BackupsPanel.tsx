import { useEffect, useState } from "react";
import { errorMessage, getBackups, readBackup, readWorkspaceFile, restoreBackup } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { Markdown } from "./Markdown.js";
import { Modal } from "./Modal.js";

interface Backup {
  name: string;
  target: string;
  stamp: string;
  size: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

function friendlyTime(stamp: string): string {
  return stamp.slice(0, 19).replace("T", " ");
}

export function BackupsPanel({ open, onClose, onRestored }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Backup[]>([]);
  const [selected, setSelected] = useState<Backup | null>(null);
  const [content, setContent] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const result = await getBackups();
        setItems(result.items);
        setSelected(null);
        setContent("");
        setCurrent("");
      } catch (caught) {
        toast("error", errorMessage(caught));
      }
    })();
  }, [open, toast]);

  const select = async (backup: Backup): Promise<void> => {
    setSelected(backup);
    try {
      const read = await readBackup(backup.name);
      setContent(read.content);
      try {
        const file = await readWorkspaceFile(backup.target);
        setCurrent(file.binary ? "（当前文件是二进制，无法对比）" : file.content);
      } catch {
        setCurrent("");
      }
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const restore = async (): Promise<void> => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await restoreBackup(selected.name);
      toast("success", `已恢复 ${result.target}`);
      onRestored?.();
      onClose();
    } catch (caught) {
      toast("error", errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="备份与恢复" onClose={onClose} className="backups-modal">
      <div className="backups-body">
        <ul className="backups-list">
          {items.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                className={`backups-item${selected?.name === item.name ? " active" : ""}`}
                onClick={() => void select(item)}
              >
                <span className="backups-target">{item.target}</span>
                <span className="muted">
                  {friendlyTime(item.stamp)} · {item.size} B
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="muted backups-empty">
              还没有备份。覆盖写 PROGRESS / GOALS / SUMMARY 等时会自动备份到 .myblog/backups/。
            </li>
          )}
        </ul>

        {selected && (
          <div className="backups-detail">
            <div className="backups-detail-head">
              <strong>{selected.target}</strong>
              <button type="button" className="btn-sm" disabled={busy} onClick={() => void restore()}>
                {busy ? "恢复中…" : "恢复到这一份"}
              </button>
            </div>
            <details open>
              <summary>备份内容（{friendlyTime(selected.stamp)}）</summary>
              <div className="backups-preview">
                <Markdown>{content}</Markdown>
              </div>
            </details>
            {current !== "" && (
              <details>
                <summary>当前内容（对比用）</summary>
                <pre className="backups-pre">{current}</pre>
              </details>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
