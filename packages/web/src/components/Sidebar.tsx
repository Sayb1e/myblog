import type { ReactNode } from "react";
import { usePrefs } from "../prefs.js";
import type { View } from "../view.js";
import { IconChat, IconCheck, IconDaily, IconOverview, IconSettings, IconTerminal } from "./icons.js";

interface Props {
  view: View;
  onView: (view: View) => void;
  stageIds: string[];
  connected: boolean;
  issueCount: number;
}

interface Item {
  key: View;
  label: string;
  icon: ReactNode;
}

export function Sidebar({ view, onView, stageIds, connected, issueCount }: Props) {
  const { prefs } = usePrefs();
  const hasTerminal = typeof window !== "undefined" && Boolean(window.myblog?.terminal);

  const items: Item[] = [
    { key: "overview", label: "概览", icon: <IconOverview /> },
    { key: "daily", label: "每日总结", icon: <IconDaily /> },
  ];
  if (prefs.chatEnabled) items.push({ key: "chat", label: "对话", icon: <IconChat /> });
  if (hasTerminal && prefs.terminalEnabled) items.push({ key: "terminal", label: "终端", icon: <IconTerminal /> });
  items.push({ key: "check", label: "校验", icon: <IconCheck /> });

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">M</span>
        <span className="brand-text">
          <span className="brand-name">MyBlog</span>
          <span className="brand-sub">学习工作区</span>
        </span>
      </div>

      <nav>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item${view === item.key ? " active" : ""}`}
            onClick={() => onView(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.key === "check" && issueCount > 0 && <span className="nav-badge">{issueCount}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="stage-pill">{stageIds.join(" · ") || "未识别阶段"}</div>
        <button
          type="button"
          className={`nav-item${view === "settings" ? " active" : ""}`}
          onClick={() => onView("settings")}
        >
          <span className="nav-icon">
            <IconSettings />
          </span>
          <span>设置</span>
        </button>
        <div className={`live ${connected ? "on" : "off"}`}>
          <span className="dot" />
          {connected ? "实时同步" : "未连接"}
        </div>
      </div>
    </aside>
  );
}
