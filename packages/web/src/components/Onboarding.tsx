import { IconCheck, IconClose } from "./icons.js";
import { WorkspaceFilesHelp } from "./WorkspaceFilesHelp.js";

export interface OnboardingProps {
  workspace: string;
  initialized: boolean;
  modelReady: boolean;
  hasChatted: boolean;
  dismissed: boolean;
  onInit: () => void;
  onOpenModel: () => void;
  onOpenChat: () => void;
  onDraftGoals?: () => void;
  onDismiss: () => void;
}

interface Step {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  action?: { label: string; run: () => void };
}

export function Onboarding(props: OnboardingProps) {
  const { workspace, initialized, modelReady, hasChatted, onInit, onOpenModel, onOpenChat, onDraftGoals } = props;

  const steps: Step[] = [
    {
      key: "workspace",
      title: "选好学习库",
      detail: workspace || "已选择",
      done: true,
    },
    {
      key: "init",
      title: "初始化结构",
      detail: initialized ? "已生成 PROGRESS.md / GOALS.md" : "生成 PROGRESS.md（进度）+ GOALS.md（能力地图）",
      done: initialized,
      ...(initialized ? {} : { action: { label: "初始化", run: onInit } }),
    },
    {
      key: "model",
      title: "配置模型",
      detail: modelReady ? "已就绪，可以对话" : "选服务商、填 API Key",
      done: modelReady,
      ...(modelReady ? {} : { action: { label: "去配置", run: onOpenModel } }),
    },
    {
      key: "chat",
      title: "提第一个问题",
      detail: "问它「今天学什么」",
      done: hasChatted,
      ...(hasChatted ? {} : { action: { label: "去对话", run: onOpenChat } }),
    },
  ];

  const done = steps.filter((step) => step.done).length;
  if (props.dismissed || done === steps.length) return null;

  return (
    <section className="card onboarding">
      <header className="onboarding-head">
        <div className="onboarding-head-text">
          <h3>开始使用</h3>
          <span className="muted">
            完成 {done}/{steps.length} 步即可开跑
          </span>
        </div>
        <button type="button" className="ghost icon-btn sm" aria-label="不再显示" data-tip="不再显示" onClick={props.onDismiss}>
          <IconClose />
        </button>
      </header>
      <ol className="onboarding-steps">
        {steps.map((step) => (
          <li key={step.key} className={`onboarding-step${step.done ? " done" : ""}`}>
            <span className="onboarding-mark">{step.done ? <IconCheck /> : <span className="onboarding-dot" />}</span>
            <span className="onboarding-text">
              <span className="onboarding-title">{step.title}</span>
              <span className="muted">{step.detail}</span>
            </span>
            {step.action && (
              <button type="button" className="btn-sm" onClick={step.action.run}>
                {step.action.label}
              </button>
            )}
          </li>
        ))}
      </ol>
      {onDraftGoals && (
        <div className="row onboarding-actions">
          <button type="button" className="btn-sm" onClick={onDraftGoals}>
            用模型生成学习目标
          </button>
          <span className="muted">说出你想学什么，自动生成 GOALS.md</span>
        </div>
      )}
      {!initialized && (
        <details className="onboarding-help">
          <summary>这两个 Markdown 文件是什么？</summary>
          <WorkspaceFilesHelp />
        </details>
      )}
    </section>
  );
}
