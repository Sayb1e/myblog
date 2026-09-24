import { useEffect, useState } from "react";
import { AGENT_PRESETS } from "../agentPresets.js";
import {
  draftGoals,
  errorMessage,
  getAgentConfig,
  initWorkspace,
  saveAgentConfig,
  saveGoals,
  testAgent,
} from "../api.js";
import { IconClose } from "./icons.js";
import { Select } from "./Select.js";
import { WorkspaceFilesHelp } from "./WorkspaceFilesHelp.js";

type Step = 1 | 2 | 3 | 4;

export function SetupWizard() {
  const [step, setStep] = useState<Step>(1);
  const [root, setRoot] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [format, setFormat] = useState<"auto" | "openai" | "anthropic">("auto");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [goalText, setGoalText] = useState("");
  const [goalMarkdown, setGoalMarkdown] = useState("");
  const [goalProblems, setGoalProblems] = useState<string[]>([]);
  const [goalPreview, setGoalPreview] = useState(false);

  const ready = baseURL.trim() !== "" && model.trim() !== "";

  // 到第 2 步时 API 已就绪，把已保存的模型配置带出来（key 不回显，但保存在本地、生成时照用）
  useEffect(() => {
    if (step !== 2) return;
    void getAgentConfig()
      .then((view) => {
        setBaseURL((current) => current || view.baseURL);
        setModel((current) => current || view.model);
        setFormat(view.format);
      })
      .catch(() => undefined);
  }, [step]);

  const applyPicked = async (picked: string): Promise<void> => {
    const run = window.myblog?.setupWorkspace;
    if (!run) {
      setNotice({ kind: "err", text: "需要在桌面端内运行" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await run(picked);
      setRoot(result.root);
      setStep(2);
    } catch (caught) {
      setNotice({ kind: "err", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  };

  const chooseFolder = async (): Promise<void> => {
    const picked = await window.myblog?.pickDirectory?.();
    if (!picked) return;
    await applyPicked(picked);
  };

  const useSample = async (): Promise<void> => {
    const create = window.myblog?.createSampleWorkspace;
    if (!create) {
      setNotice({ kind: "err", text: "需要在桌面端内运行" });
      return;
    }
    const parent = await window.myblog?.pickDirectory?.();
    if (!parent) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await create(parent);
      setRoot(result.root);
      setStep(2);
    } catch (caught) {
      setNotice({ kind: "err", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  };

  const test = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await testAgent({ baseURL, model, ...(apiKey ? { apiKey } : {}), format });
      setNotice({ kind: "ok", text: `连接成功：${result.message}` });
    } catch (caught) {
      setNotice({ kind: "err", text: `连接失败：${errorMessage(caught)}` });
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      await saveAgentConfig({ baseURL, model, ...(apiKey ? { apiKey } : {}), format, target: "default" });
      setStep(3);
    } catch (caught) {
      setNotice({ kind: "err", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  };

  const finish = async (): Promise<void> => {
    setBusy(true);
    try {
      await initWorkspace();
    } catch {
      // 已初始化或权限问题都无所谓，继续
    } finally {
      setBusy(false);
      setStep(4);
    }
  };

  const generateGoals = async (): Promise<void> => {
    if (goalText.trim() === "") {
      setNotice({ kind: "err", text: "先写点你想学的东西，或点「跳过」" });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await draftGoals(goalText);
      setGoalMarkdown(result.markdown);
      setGoalProblems(result.validation.ok ? [] : result.validation.problems);
      setGoalPreview(true);
    } catch (caught) {
      setNotice({ kind: "err", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  };

  const saveGoalsAndContinue = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      await saveGoals(goalMarkdown);
      await finish();
    } catch (caught) {
      setNotice({ kind: "err", text: errorMessage(caught) });
      setBusy(false);
    }
  };

  return (
    <div className="setup">
      <header className="setup-bar">
        <span className="setup-brand">MyBlog</span>
        <button
          type="button"
          className="icon-btn sm"
          aria-label="关闭"
          data-tip="关闭"
          onClick={() => window.myblog?.windowControls?.close()}
        >
          <IconClose />
        </button>
      </header>

      <div className="setup-body">
        {step === 1 && (
          <section className="setup-card">
            <h1>欢迎使用 MyBlog</h1>
            <p className="muted">学习库就是一个存 Markdown 笔记的文件夹。选一个空文件夹即可，MyBlog 会生成最简结构。</p>
            <WorkspaceFilesHelp />
            <div className="setup-actions">
              <button type="button" className="primary" disabled={busy} onClick={() => void chooseFolder()}>
                选择文件夹…
              </button>
              <button type="button" disabled={busy} onClick={() => void useSample()}>
                用示例学习库…
              </button>
            </div>
            {notice && <p className={notice.kind === "err" ? "warn-text" : "muted"}>{notice.text}</p>}
            <p className="muted setup-foot">
              已有学习库？直接选它即可，不会覆盖你的文件。示例会建在你所选目录下的「MyBlog 示例学习库」。
            </p>
          </section>
        )}

        {step === 2 && (
          <section className="setup-card">
            <h1>配置模型</h1>
            <p className="muted">
              学习库：<code>{root || "已选择"}</code>
            </p>
            <label className="setup-field">
              服务商预设
              <Select
                value=""
                placeholder="选择服务商，自动填 Base URL / Model…"
                options={[
                  { value: "", label: "选择服务商，自动填 Base URL / Model…" },
                  ...AGENT_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
                ]}
                onChange={(id) => {
                  const preset = AGENT_PRESETS.find((item) => item.id === id);
                  if (!preset || preset.id === "custom") return;
                  setBaseURL(preset.baseURL);
                  setModel(preset.model);
                }}
              />
            </label>
            <label className="setup-field">
              Base URL
              <input value={baseURL} onChange={(event) => setBaseURL(event.target.value)} placeholder="https://api.deepseek.com/v1" />
            </label>
            <label className="setup-field">
              Model
              <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="deepseek-chat" />
            </label>
            <label className="setup-field">
              API Key
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." />
            </label>
            <label className="setup-field">
              API 格式
              <Select
                value={format}
                options={[
                  { value: "auto", label: "自动（按 baseURL / 模型名推断）" },
                  { value: "openai", label: "OpenAI 兼容（/chat/completions）" },
                  { value: "anthropic", label: "Anthropic（/messages，Claude 系）" },
                ]}
                onChange={(value) => setFormat(value as "auto" | "openai" | "anthropic")}
              />
            </label>
            {notice && <p className={notice.kind === "err" ? "warn-text" : "muted"}>{notice.text}</p>}
            <div className="setup-actions">
              <button type="button" disabled={busy || !ready} onClick={() => void test()}>
                测试连接
              </button>
              <button type="button" className="primary" disabled={busy || !ready} onClick={() => void save()}>
                保存并继续
              </button>
              <button type="button" disabled={busy} onClick={() => setStep(3)}>
                稍后配置
              </button>
            </div>
            <p className="muted setup-foot">Key 只存在本地，不会上传。</p>
          </section>
        )}

        {step === 3 && (
          <section className="setup-card">
            <h1>说说你想学什么</h1>
            <p className="muted">
              用你自己的话写：想学什么、现在什么基础、能投入多少时间、想达成什么。模型会整理成{" "}
              <code>GOALS.md</code>，保存前你可以先改。也可以跳过，之后在「概览 → 能力地图」里再生成。
            </p>
            {!goalPreview ? (
              <>
                <textarea
                  className="setup-textarea"
                  rows={7}
                  value={goalText}
                  placeholder="例如：我想入门安卓逆向。会一点 Java，装过 adb 但没用过 Frida。每天 1 小时，希望半年内能独立分析一个简单 App 的加固逻辑。"
                  onChange={(event) => setGoalText(event.target.value)}
                />
                {notice && <p className={notice.kind === "err" ? "warn-text" : "muted"}>{notice.text}</p>}
                <div className="setup-actions">
                  <button type="button" className="primary" disabled={busy || !ready} onClick={() => void generateGoals()}>
                    {busy ? "生成中…" : "生成学习目标"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => void finish()}>
                    跳过
                  </button>
                </div>
                {!ready && <p className="muted setup-foot">还没配好模型，点「跳过」即可；之后在「对话 → 设置」里配置再用。</p>}
              </>
            ) : (
              <>
                {goalProblems.length > 0 && (
                  <div className="goals-gen-warn">
                    <strong>格式检查没通过，保存会被拒绝：</strong>
                    <ul className="goals-gen-problems">
                      {goalProblems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <textarea
                  className="setup-textarea setup-textarea-code"
                  rows={11}
                  value={goalMarkdown}
                  spellCheck={false}
                  onChange={(event) => setGoalMarkdown(event.target.value)}
                />
                {notice && <p className={notice.kind === "err" ? "warn-text" : "muted"}>{notice.text}</p>}
                <div className="setup-actions">
                  <button type="button" className="primary" disabled={busy} onClick={() => void saveGoalsAndContinue()}>
                    {busy ? "保存中…" : "保存并继续"}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setGoalPreview(false)}>
                    返回修改
                  </button>
                  <button type="button" disabled={busy} onClick={() => void finish()}>
                    跳过
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {step === 4 && (
          <section className="setup-card">
            <div className="setup-done-mark">M</div>
            <h1>准备就绪</h1>
            <p className="muted">
              学习库：<code>{root || "已选择"}</code>
            </p>
            <ol className="setup-next">
              <li>去「每日总结」写当天，或直接问它「今天学什么」</li>
              <li>想改学习目标：概览 → 能力地图 →「生成 / 更新目标…」</li>
              <li>「概览」会显示能力地图与进度，校验页可看一致性问题</li>
            </ol>
            <div className="setup-actions">
              <button type="button" className="primary" onClick={() => window.location.reload()}>
                进入 MyBlog
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
