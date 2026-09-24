import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressSnapshot } from "@myblog/core";
import {
  errorMessage,
  getAgentConfig,
  getPlugins,
  patchProgress,
  runPluginCommand,
  scaffoldDay,
  searchWorkspace,
  setCapabilityStatus,
} from "./api.js";
import {
  addWorkspace,
  commitGit,
  getGit,
  getWorkspaces,
  initWorkspace,
  removeWorkspace,
  renameWorkspace,
  switchWorkspace,
  type GitState,
  type WorkspaceList,
} from "./api.js";
import { CapabilityMap } from "./components/CapabilityMap.js";
import { ChatView } from "./components/ChatView.js";
import { CheckView } from "./components/CheckView.js";
import { CommandPalette, type Command } from "./components/CommandPalette.js";
import { DailyView } from "./components/DailyView.js";
import { EmptyState } from "./components/EmptyState.js";
import { FilesView } from "./components/FilesView.js";
import { GitCard } from "./components/GitCard.js";
import { GoalsGenerator } from "./components/GoalsGenerator.js";
import { IconPencil, IconTrash } from "./components/icons.js";
import { MarkdownProvider } from "./components/Markdown.js";
import { Onboarding } from "./components/Onboarding.js";
import { ProgressCard } from "./components/ProgressCard.js";
import { SettingsView } from "./components/SettingsView.js";
import { type SelectOption } from "./components/Select.js";
import { Sidebar } from "./components/Sidebar.js";
import { SkeletonCard } from "./components/Skeleton.js";
import { ShortcutHelp } from "./components/ShortcutHelp.js";
import { Timeline } from "./components/Timeline.js";
import { TodayCard } from "./components/TodayCard.js";
import { TooltipLayer } from "./components/Tooltip.js";
import { WindowControls } from "./components/WindowControls.js";
import { WorkspaceFilesHelp } from "./components/WorkspaceFilesHelp.js";
import { useToast } from "./hooks/useToasts.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { usePrefs } from "./prefs.js";
import type { View } from "./view.js";

const TerminalView = lazy(() =>
  import("./components/TerminalView.js").then((module) => ({ default: module.TerminalView })),
);

const TITLES: Record<View, string> = {
  overview: "概览",
  daily: "每日总结",
  files: "文件",
  chat: "对话",
  terminal: "终端",
  check: "校验",
  settings: "设置",
};

export function App() {
  const { status, today, check, summaries, loading, error, connected, refresh } = useWorkspace();
  const { prefs, setPref } = usePrefs();
  const toast = useToast();
  const [view, setView] = useState<View>("overview");
  const [date, setDate] = useState("");
  const [skill, setSkill] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceList | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageEditing, setManageEditing] = useState<string | null>(null);
  const [manageValue, setManageValue] = useState("");
  const [manageRemoving, setManageRemoving] = useState<string | null>(null);
  const [visited, setVisited] = useState<Partial<Record<View, boolean>>>({ overview: true });
  const [modelReady, setModelReady] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [pluginCommands, setPluginCommands] = useState<{ id: string; title: string; hint: string }[]>([]);
  const [chatted, setChatted] = useState(() => localStorage.getItem("myblog:onboard:chatted") === "1");
  const [onboardDismissed, setOnboardDismissed] = useState(
    () => localStorage.getItem("myblog:onboard:dismissed") === "1",
  );

  useEffect(() => {
    if (!prefs.chatEnabled && view === "chat") setView("overview");
  }, [prefs.chatEnabled, view]);

  useEffect(() => {
    setVisited((current) => (current[view] ? current : { ...current, [view]: true }));
  }, [view]);

  const viewClass = (key: View): string => {
    if (!visited[key]) return "view hidden";
    return view === key ? "view active" : "view";
  };

  useEffect(() => {
    if (!date && status?.records[0]?.date) setDate(status.records[0].date);
  }, [status, date]);

  useEffect(() => {
    if (error) toast("error", error);
  }, [error, toast]);

  const skillsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const summary of summaries) map.set(summary.date, summary.skills);
    return map;
  }, [summaries]);

  const openDate = useCallback((value: string) => {
    setDate(value);
    setView("daily");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.key === "?") {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        event.preventDefault();
        setHelpOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const workspace = status?.root ? status.root.split(/[\\/]/).filter(Boolean).pop() ?? "" : "";
  const initialized = status ? status.initialized !== false : true;
  const stageLabel = status
    ? status.stageIds
        .map((id) => {
          const capability = status.capabilities.find((entry) => entry.id === id);
          return capability ? `${id} ${capability.name}` : id;
        })
        .join(" · ")
    : "";

  useEffect(() => {
    void getWorkspaces()
      .then(setWorkspaces)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void getPlugins()
      .then((view) => setPluginCommands(Array.isArray(view?.commands) ? view.commands : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const load = (): void => {
      void getAgentConfig()
        .then((view) => setModelReady(view.ready))
        .catch(() => undefined);
    };
    load();
    const onChat = (): void => setChatted(true);
    window.addEventListener("myblog:agent-changed", load);
    window.addEventListener("myblog:chatted", onChat);
    return () => {
      window.removeEventListener("myblog:agent-changed", load);
      window.removeEventListener("myblog:chatted", onChat);
    };
  }, []);

  const changeWorkspace = async (target: string): Promise<void> => {
    if (!target || target === status?.root) return;
    try {
      await switchWorkspace(target);
      window.location.reload();
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const addWorkspaceFolder = async (): Promise<void> => {
    const picked = await window.myblog?.pickDirectory?.();
    if (!picked) return;
    try {
      const next = await addWorkspace(picked);
      setWorkspaces(next);
      toast("success", "已添加工作区");
      if (next.active === picked) window.location.reload();
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const bootstrap = async (): Promise<void> => {
    try {
      const result = await initWorkspace();
      toast("success", result.created.length > 0 ? `已创建：${result.created.join("、")}` : "文件已存在");
      await refresh();
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const todayString = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const writeToday = async (): Promise<void> => {
    const target = todayString();
    try {
      const result = await scaffoldDay(target);
      toast(result.created ? "success" : "info", result.created ? "已新建今日总结" : "今日总结已存在");
      await refresh();
      openDate(target);
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const workspaceName = (entry: string): string =>
    workspaces?.names?.[entry] ?? entry.split(/[\\/]/).filter(Boolean).pop() ?? entry;

  const workspaceOptions = useMemo<SelectOption[]>(() => {
    const list = workspaces?.list ?? [];
    const options = list.map((entry) => ({ value: entry, label: workspaceName(entry) }));
    if (status?.root && !list.includes(status.root)) {
      options.unshift({ value: status.root, label: workspaceName(status.root) });
    }
    return options;
  }, [workspaces, status?.root, workspace]);

  const saveWorkspaceName = async (): Promise<void> => {
    if (!manageEditing) return;
    try {
      const next = await renameWorkspace(manageEditing, manageValue);
      setWorkspaces(next);
      setManageEditing(null);
      toast("success", manageValue.trim() === "" ? "已恢复默认名字" : "已重命名工作区");
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const confirmRemoveWorkspace = async (): Promise<void> => {
    if (!manageRemoving) return;
    try {
      const wasActive = manageRemoving === workspaces?.active;
      const next = await removeWorkspace(manageRemoving);
      setWorkspaces(next);
      setManageRemoving(null);
      toast("success", "已从列表移除（磁盘文件未动）");
      if (wasActive) window.location.reload();
    } catch (caught) {
      toast("error", errorMessage(caught));
    }
  };

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: "view:overview", label: "打开：概览", run: () => setView("overview") },
      { id: "view:daily", label: "打开：每日总结", run: () => setView("daily") },
    ];
    list.push({ id: "view:files", label: "打开：文件", run: () => setView("files") });
    if (prefs.chatEnabled) list.push({ id: "view:chat", label: "打开：对话", run: () => setView("chat") });
    if (prefs.terminalEnabled) list.push({ id: "view:terminal", label: "打开：终端", run: () => setView("terminal") });
    list.push({ id: "view:check", label: "打开：校验", run: () => setView("check") });
    list.push({ id: "view:settings", label: "打开：设置", run: () => setView("settings") });
    list.push({ id: "action:refresh", label: "刷新工作区", run: () => void refresh() });
    list.push({
      id: "action:theme",
      label: "切换主题：深色 / 浅色 / 跟随系统",
      hint: prefs.theme,
      run: () => setPref("theme", prefs.theme === "dark" ? "light" : prefs.theme === "light" ? "system" : "dark"),
    });
    list.push({
      id: "action:style",
      label: "切换界面风格：产品 / 原生",
      hint: prefs.style,
      run: () => setPref("style", prefs.style === "product" ? "native" : "product"),
    });
    list.push({
      id: "action:sidebar",
      label: prefs.sidebarCollapsed ? "展开侧栏" : "收起侧栏",
      run: () => setPref("sidebarCollapsed", !prefs.sidebarCollapsed),
    });
    list.push({
      id: "action:signature",
      label: prefs.signatureEnabled ? "关闭个性签名" : "开启个性签名",
      hint: prefs.signature || undefined,
      run: () => setPref("signatureEnabled", !prefs.signatureEnabled),
    });
    list.push({ id: "action:write-today", label: "写今天的总结", hint: "scaffold", run: () => void writeToday() });
    list.push({ id: "action:goals", label: "生成 / 更新学习目标", hint: "GOALS.md", run: () => setGoalsOpen(true) });
    for (const entry of workspaces?.list ?? []) {
      if (entry === status?.root) continue;
      list.push({
        id: `ws:${entry}`,
        label: `切换工作区：${workspaceName(entry)}`,
        run: () => void changeWorkspace(entry),
      });
    }
    for (const command of pluginCommands) {
      list.push({
        id: `plugin:${command.id}`,
        label: command.title,
        hint: command.hint || "插件",
        run: () => {
          void runPluginCommand(command.id)
            .then(() => toast("success", `已执行：${command.title}`))
            .catch((caught) => toast("error", errorMessage(caught)));
        },
      });
    }
    for (const summary of summaries.slice(0, 6)) {
      list.push({
        id: `date:${summary.date}`,
        label: `打开日期：${summary.date}`,
        hint: summary.skills.join(" "),
        run: () => openDate(summary.date),
      });
    }
    return list;
  }, [openDate, prefs, pluginCommands, refresh, setPref, summaries, toast, workspaces, status?.root]);

  const saveProgress = useCallback(
    async (patch: Partial<ProgressSnapshot>) => {
      try {
        const result = await patchProgress(patch);
        toast(result.changed ? "success" : "info", result.changed ? "已更新总览" : "内容没有变化");
        await refresh();
      } catch (caught) {
        toast("error", errorMessage(caught));
      }
    },
    [refresh, toast],
  );

  const runSearch = useCallback(
    async (query: string) => (await searchWorkspace(query, 60)).hits,
    [],
  );

  const openHit = useCallback(
    (hit: { date: string | null }) => {
      if (hit.date) openDate(hit.date);
      else setView("overview");
    },
    [openDate],
  );

  const saveCapability = useCallback(
    async (id: string, nextStatus: string) => {
      try {
        const result = await setCapabilityStatus(id, nextStatus);
        toast(result.changed ? "success" : "info", result.changed ? `已更新 ${id} 状态` : "状态没有变化");
        await refresh();
      } catch (caught) {
        toast("error", errorMessage(caught));
      }
    },
    [refresh, toast],
  );

  return (
    <div className="shell">
      <Sidebar
        view={view}
        onView={setView}
        stageLabel={stageLabel}
        connected={connected}
        issueCount={check?.issues.length ?? 0}
        root={status?.root ?? ""}
        workspaceOptions={workspaceOptions}
        onSwitchWorkspace={(target) => void changeWorkspace(target)}
        onAddWorkspace={() => void addWorkspaceFolder()}
        onManageWorkspaces={() => setManageOpen(true)}
      />

      <main className="main">
        <div
          className="topbar"
          onDoubleClick={() => window.myblog?.windowControls?.toggleMaximize()}
        >
          <h1>{TITLES[view]}</h1>
          {prefs.signatureEnabled && prefs.signature.trim() !== "" && (
            <span className="topbar-signature">{prefs.signature}</span>
          )}
          <WindowControls />
        </div>

        <div className="content">
        <div className={viewClass("overview")}>
          <MarkdownProvider openDate={openDate}>
            <div className="overview">
              {!status && loading && (
                <div className="grid">
                  <SkeletonCard lines={4} />
                  <SkeletonCard lines={6} />
                  <SkeletonCard lines={5} />
                </div>
              )}
              {status && (
                <Onboarding
                  workspace={workspace}
                  initialized={initialized}
                  modelReady={modelReady}
                  hasChatted={chatted}
                  dismissed={onboardDismissed}
                  onInit={() => void bootstrap()}
                  onOpenModel={() => {
                    setView("chat");
                    window.dispatchEvent(new Event("myblog:open-agent-settings"));
                  }}
                  onOpenChat={() => setView("chat")}
                  onDraftGoals={() => setGoalsOpen(true)}
                  onDismiss={() => {
                    setOnboardDismissed(true);
                    try {
                      localStorage.setItem("myblog:onboard:dismissed", "1");
                    } catch {
                      // localStorage unavailable
                    }
                  }}
                />
              )}
              {status && !initialized && onboardDismissed && (
                <EmptyState
                  className="card"
                  mark="M"
                  title="这个文件夹还不是学习仓"
                  description="没有找到「PROGRESS.md」。可以一键生成最小结构，之后即可规划与写回；也可以先去「对话」里随便聊聊。"
                >
                  <WorkspaceFilesHelp />
                  <div className="row">
                    <button type="button" className="primary" onClick={() => void bootstrap()}>
                      初始化工作区
                    </button>
                    <button type="button" onClick={() => setGoalsOpen(true)}>
                      用模型生成学习目标
                    </button>
                  </div>
                </EmptyState>
              )}
              {initialized && today && (
                <TodayCard
                  plan={today}
                  workspace={workspace}
                  onOpenDate={openDate}
                  onOpenPalette={() => setPaletteOpen(true)}
                  onInit={() => void bootstrap()}
                  onWriteToday={() => void writeToday()}
                />
              )}
              {initialized && (
                <div className="grid">
                  {status && <ProgressCard progress={status.progress} onSave={saveProgress} />}
                  {status && (
                    <CapabilityMap
                      capabilities={status.capabilities}
                      selected={skill}
                      onSelect={setSkill}
                      onSaveStatus={saveCapability}
                      onInit={() => void bootstrap()}
                      onDraftGoals={() => setGoalsOpen(true)}
                      history={skillsByDate}
                    />
                  )}
                  {status && (
                    <Timeline
                      records={status.records}
                      skillsByDate={skillsByDate}
                      skill={skill}
                      onOpen={openDate}
                    />
                  )}
                  <GitCard onCommitted={refresh} />
                </div>
              )}
            </div>
          </MarkdownProvider>
        </div>

        {visited.daily && (
          <div className={viewClass("daily")}>
            <MarkdownProvider openDate={openDate}>
              <DailyView date={date} summaries={summaries} onSelectDate={setDate} onRefresh={refresh} />
            </MarkdownProvider>
          </div>
        )}

        {visited.files && (
          <div className={viewClass("files")}>
            <MarkdownProvider openDate={openDate}>
              <FilesView root={status?.root ?? ""} />
            </MarkdownProvider>
          </div>
        )}

        {visited.chat && prefs.chatEnabled && (
          <div className={viewClass("chat")}>
            <MarkdownProvider openDate={openDate}>
              <ChatView />
            </MarkdownProvider>
          </div>
        )}

        {visited.terminal && prefs.terminalEnabled && (
          <div className={viewClass("terminal")}>
            <Suspense fallback={<p className="muted">加载终端…</p>}>
              <TerminalView cwd={status?.root ?? ""} active={view === "terminal"} />
            </Suspense>
          </div>
        )}

        {visited.check && <div className={viewClass("check")}>{check && <CheckView result={check} />}</div>}

        {visited.settings && (
          <div className={viewClass("settings")}>
            <SettingsView root={status?.root ?? ""} version={status?.version ?? ""} />
          </div>
        )}
        </div>
      </main>

      {manageOpen && (
        <div
          className="palette-overlay"
          onClick={() => {
            setManageOpen(false);
            setManageEditing(null);
            setManageRemoving(null);
          }}
        >
          <div className="palette dialog ws-manage" onClick={(event) => event.stopPropagation()}>
            <div className="palette-input">
              <strong>管理工作区</strong>
            </div>
            <div className="dialog-body">
              <ul className="ws-manage-list">
                {(workspaces?.list ?? []).map((entry) => (
                  <li key={entry} className="ws-manage-row">
                    {manageEditing === entry ? (
                      <input
                        autoFocus
                        value={manageValue}
                        placeholder={workspaceName(entry)}
                        onChange={(event) => setManageValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void saveWorkspaceName();
                          if (event.key === "Escape") setManageEditing(null);
                        }}
                      />
                    ) : (
                      <span className="ws-manage-text">
                        <span className="ws-manage-name">
                          {workspaceName(entry)}
                          {entry === workspaces?.active && <span className="chip">当前</span>}
                        </span>
                        <span className="muted ws-manage-path">{entry}</span>
                      </span>
                    )}
                    <span className="ws-manage-actions">
                      {manageEditing === entry ? (
                        <>
                          <button type="button" className="primary btn-sm" onClick={() => void saveWorkspaceName()}>
                            保存
                          </button>
                          <button type="button" className="btn-sm" onClick={() => setManageEditing(null)}>
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="ghost icon-btn sm"
                            aria-label="重命名"
                            data-tip="重命名"
                            onClick={() => {
                              setManageEditing(entry);
                              setManageValue(workspaces?.names?.[entry] ?? "");
                            }}
                          >
                            <IconPencil />
                          </button>
                          <button
                            type="button"
                            className="ghost icon-btn sm"
                            aria-label="从列表移除"
                            data-tip="从列表移除（不删文件）"
                            disabled={(workspaces?.list.length ?? 0) <= 1}
                            onClick={() => setManageRemoving(entry)}
                          >
                            <IconTrash />
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {manageRemoving && (
                <div className="ws-manage-confirm">
                  <p className="muted">
                    从列表移除「{workspaceName(manageRemoving)}」？只取消登记，<strong>不会删除</strong>磁盘上的文件。
                  </p>
                  <div className="row">
                    <button type="button" className="primary danger" onClick={() => void confirmRemoveWorkspace()}>
                      移除
                    </button>
                    <button type="button" onClick={() => setManageRemoving(null)}>
                      取消
                    </button>
                  </div>
                </div>
              )}

              <div className="row">
                <button type="button" onClick={() => void addWorkspaceFolder()}>
                  添加工作区…
                </button>
                <button type="button" onClick={() => setManageOpen(false)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <GoalsGenerator
        open={goalsOpen}
        modelReady={modelReady}
        onOpenModel={() => {
          setView("chat");
          window.dispatchEvent(new Event("myblog:open-agent-settings"));
        }}
        onSaved={() => {
          void (async () => {
            if (!initialized) {
              try {
                await initWorkspace();
              } catch {
                // 已初始化或权限问题，忽略
              }
            }
            await refresh();
          })();
        }}
        onClose={() => setGoalsOpen(false)}
      />

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
        onSearch={runSearch}
        onOpenHit={openHit}
      />
      <TooltipLayer />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
