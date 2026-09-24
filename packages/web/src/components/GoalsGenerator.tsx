import { useState } from "react";
import { draftGoals, errorMessage, saveGoals } from "../api.js";
import { useToast } from "../hooks/useToasts.js";
import { IconSpark } from "./icons.js";
import { Markdown } from "./Markdown.js";
import { Modal } from "./Modal.js";

interface Props {
  open: boolean;
  modelReady: boolean;
  onOpenModel: () => void;
  onSaved: () => void;
  onClose: () => void;
}

type Stage = "input" | "preview";

export function GoalsGenerator({ open, modelReady, onOpenModel, onSaved, onClose }: Props) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const close = (): void => {
    if (busy) return;
    setStage("input");
    setProblems([]);
    onClose();
  };

  const generate = async (): Promise<void> => {
    if (text.trim() === "") {
      toast("info", "先写点你想学的东西");
      return;
    }
    setBusy(true);
    setProblems([]);
    try {
      const result = await draftGoals(text);
      setMarkdown(result.markdown);
      setProblems(result.validation.ok ? [] : result.validation.problems);
      setStage("preview");
    } catch (caught) {
      toast("error", errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await saveGoals(markdown);
      toast("success", `已写入 ${result.path}（${result.capabilities} 个能力）`);
      onSaved();
      setStage("input");
      onClose();
    } catch (caught) {
      toast("error", errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const openModel = (): void => {
    close();
    onOpenModel();
  };

  return (
    <Modal
      open={open}
      className="goals-gen"
      onClose={close}
      title={
        <>
          <IconSpark />
          {stage === "input" ? "生成学习目标" : "预览并保存"}
        </>
      }
    >
      <div className="dialog-body goals-gen-body">
          {stage === "input" ? (
            <>
              <p className="muted">
                用你自己的话写：想学什么、现在什么基础、能投入多少时间、想达成什么。模型会整理成{" "}
                <code className="code">GOALS.md</code>，保存前你可以先改。
              </p>
              <textarea
                className="goals-gen-input"
                data-autofocus
                value={text}
                rows={8}
                placeholder="例如：我想入门安卓逆向。会一点 Java，装过 adb 但没用过 Frida。每天 1 小时，希望半年内能独立分析一个简单 App 的加固逻辑。"
                onChange={(event) => setText(event.target.value)}
              />
              {problems.length > 0 && (
                <ul className="goals-gen-problems">
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              )}
              <div className="row">
                <button type="button" className="primary" disabled={busy || !modelReady} onClick={() => void generate()}>
                  {busy ? "生成中…" : "生成"}
                </button>
                {!modelReady && (
                  <button type="button" onClick={openModel}>
                    先去配置模型
                  </button>
                )}
                <button type="button" onClick={close}>
                  取消
                </button>
              </div>
              {!modelReady && <p className="muted">还没配置模型：先在「对话 → 设置」里填 Base URL / Model / Key。</p>}
            </>
          ) : (
            <>
              <p className="muted">
                下面是生成的 <code className="code">GOALS.md</code>；保存会覆盖工作区里现有的同名文件，可以直接改。
              </p>
              {problems.length > 0 && (
                <div className="goals-gen-warn">
                  <strong>格式检查没通过，保存会被拒绝：</strong>
                  <ul className="goals-gen-problems">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </div>
              )}
              <textarea
                className="goals-gen-input goals-gen-code"
                value={markdown}
                rows={12}
                spellCheck={false}
                onChange={(event) => setMarkdown(event.target.value)}
              />
              <details className="goals-gen-preview">
                <summary>预览效果</summary>
                <div className="goals-gen-render md">
                  <Markdown>{markdown}</Markdown>
                </div>
              </details>
              <div className="row">
                <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
                  {busy ? "保存中…" : "保存到 GOALS.md"}
                </button>
                <button type="button" disabled={busy} onClick={() => setStage("input")}>
                  返回修改想法
                </button>
                <button type="button" disabled={busy} onClick={() => void generate()}>
                  重新生成
                </button>
              </div>
            </>
          )}
        </div>
    </Modal>
  );
}
