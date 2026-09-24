import type { ReactNode } from "react";
import { usePrefs } from "../prefs.js";
import type { View } from "../view.js";
import {
  IconChat,
  IconCheck,
  IconChevron,
  IconDaily,
  IconFolder,
  IconFolderOpen,
  IconOverview,
  IconSettings,
  IconSliders,
  IconTerminal,
  IconWrench,
} from "./icons.js";
import { Select, type SelectOption } from "./Select.js";

interface Props {
  view: View;
  onView: (view: View) => void;
  stageLabel: string;
  connected: boolean;
  issueCount: number;
  root: string;
  workspaceOptions: SelectOption[];
  onSwitchWorkspace: (path: string) => void;
  onAddWorkspace: () => void;
  onManageWorkspaces: () => void;
}

interface Item {
  key: View;
  label: string;
  icon: ReactNode;
}

export function Sidebar({
  view,
  onView,
  stageLabel,
  connected,
  issueCount,
  root,
  workspaceOptions,
  onSwitchWorkspace,
  onAddWorkspace,
  onManageWorkspaces,
}: Props) {
  const { prefs, setPref } = usePrefs();
  const hasTerminal = typeof window !== "undefined" && Boolean(window.myblog?.terminal);
  const workspace = root ? root.split(/[\\/]/).filter(Boolean).pop() ?? "" : "";

  const items: Item[] = [
    { key: "overview", label: "概览", icon: <IconOverview /> },
    { key: "daily", label: "每日总结", icon: <IconDaily /> },
    { key: "files", label: "文件", icon: <IconFolderOpen /> },
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
          <span className="brand-sub" title={root}>
            {workspace || "学习工作区"}
          </span>
        </span>
      </div>

      <nav>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item${view === item.key ? " active" : ""}`}
            onClick={() => onView(item.key)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.key === "check" && issueCount > 0 && <span className="nav-badge">{issueCount}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="stage-pill">{stageLabel || "未识别阶段"}</div>
        <div className="workspace-switch">
          <Select
            value={root}
            options={workspaceOptions}
            onChange={onSwitchWorkspace}
            placeholder="工作区"
            placement="up"
            icon={<IconWrench />}
            actions={[
              { label: "添加工作区…", icon: <IconFolder />, onSelect: onAddWorkspace },
              { label: "管理工作区…", icon: <IconSliders />, onSelect: onManageWorkspaces },
            ]}
          />
        </div>
        <button
          type="button"
          className={`nav-item${view === "settings" ? " active" : ""}`}
          onClick={() => onView("settings")}
          title="设置"
        >
          <span className="nav-icon">
            <IconSettings />
          </span>
          <span className="nav-label">设置</span>
        </button>
        <button
          type="button"
          className="nav-item collapse-toggle"
          onClick={() => setPref("sidebarCollapsed", !prefs.sidebarCollapsed)}
          title={prefs.sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
        >
          <span className="nav-icon" style={{ transform: prefs.sidebarCollapsed ? "rotate(180deg)" : undefined }}>
            <IconChevron />
          </span>
          <span className="nav-label">收起侧栏</span>
        </button>
        <div className={`live ${connected ? "on" : "off"}`}>
          <span className="dot" />
          <span className="live-text">{connected ? "实时同步" : "未连接"}</span>
        </div>
      </div>
    </aside>
  );
}
