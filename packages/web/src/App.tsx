import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import type { ProgressSnapshot } from "@myblog/core";
import { errorMessage, patchProgress, searchWorkspace, setCapabilityStatus } from "./api.js";
import {
  addWorkspace,
  commitGit,
  getGit,
  getWorkspaces,
  initWorkspace,
  switchWorkspace,
  type GitState,
  type WorkspaceList,
} from "./api.js";
import { CapabilityMap } from "./components/CapabilityMap.js";
import { ChatView } from "./components/ChatView.js";
import { CheckView } from "./components/CheckView.js";
import { CommandPalette, type Command } from "./components/CommandPalette.js";
import { DailyView } from "./components/DailyView.js";
import { FilesView } from "./components/FilesView.js";
import { GitCard } from "./components/GitCard.js";
import { MarkdownProvider } from "./components/Markdown.js";
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
  const [visited, setVisited] = useState<Partial<Record<View, boolean>>>({ overview: true });

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

  const workspaceOptions = useMemo<SelectOption[]>(() => {    const list = workspaces?.list ?? [];
    const options = list.map((entry) => ({
      value: entry,
      label: entry.split(/[\\/]/).filter(Boolean).pop() ?? entry,
    }));
    if (status?.root && !list.includes(status.root)) {
      options.unshift({ value: status.root, label: workspace || status.root });
    }
    return options;
  }, [workspaces, status?.root, workspace]);

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
    for (const summary of summaries.slice(0, 6)) {
      list.push({
        id: `date:${summary.date}`,
        label: `打开日期：${summary.date}`,
        hint: summary.skills.join(" "),
        run: () => openDate(summary.date),
      });
    }
    return list;
  }, [openDate, prefs, refresh, setPref, summaries]);

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
      />

      <main className="main">
        <div
          className="topbar"
          onDoubleClick={() => window.myblog?.windowControls?.toggleMaximize()}
        >
          <h1>{TITLES[view]}</h1>
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
              {status && !initialized && (
                <section className="card empty-state">
                  <div className="empty-mark">M</div>
                  <h2>这个文件夹还不是学习仓</h2>
                  <p className="muted">
                    没有找到「PROGRESS.md」。可以一键生成最小结构（学习进度总览 + 岗位目标），之后即可规划与写回；也可以先去「对话」里随便聊聊。
                  </p>
                  <button type="button" className="primary" onClick={() => void bootstrap()}>
                    初始化工作区
                  </button>
                </section>
              )}
              {initialized && today && (
                <TodayCard
                  plan={today}
                  workspace={workspace}
                  onOpenDate={openDate}
                  onOpenPalette={() => setPaletteOpen(true)}
                  onInit={() => void bootstrap()}
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
